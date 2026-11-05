const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12_000;

export type ResumeExtractionResult = {
  text: string;
  method: "docx-xml" | "pdf-text";
  warning?: string;
};

function decodeXml(value: string): string {
  const decodeCodePoint = (code: string, radix: number) => {
    const point = Number.parseInt(code, radix);
    return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point)
      : String.fromCharCode(0xfffd);
  };
  return value
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => decodeCodePoint(code, 16))
    .replace(/&#(\d+);/g, (_, code: string) => decodeCodePoint(code, 10))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/([a-z])-[ \t]*\n([a-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

async function decompress(
  bytes: Uint8Array,
  format: "deflate" | "deflate-raw",
  expectedSize?: number,
): Promise<Uint8Array> {
  if (expectedSize !== undefined && expectedSize > MAX_EXPANDED_BYTES) {
    throw new Error("The document contains an oversized compressed section.");
  }

  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_EXPANDED_BYTES) {
        await reader.cancel();
        throw new Error("The document expands beyond the safe extraction limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdOffset = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;

  for (let offset = bytes.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("The DOCX archive directory is missing or invalid.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();
  let cursor = centralDirectoryOffset;

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("The DOCX archive contains an invalid directory entry.");
    }

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name !== "word/document.xml") continue;
    if (expandedSize > MAX_EXPANDED_BYTES || compressedSize > MAX_DOCUMENT_BYTES) {
      throw new Error("The DOCX document body exceeds the extraction limit.");
    }
    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error("The DOCX document body has an invalid archive header.");
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    if (compressed.length !== compressedSize) throw new Error("The DOCX document body is incomplete.");

    let xmlBytes: Uint8Array;
    if (method === 0) xmlBytes = compressed;
    else if (method === 8) xmlBytes = await decompress(compressed, "deflate-raw", expandedSize);
    else throw new Error("This DOCX compression method is not supported.");

    const xml = decoder.decode(xmlBytes);
    const paragraphs: string[] = [];
    for (const paragraph of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
      const body = paragraph[1];
      const style = body.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
      const isHeading = /^(?:title|subtitle|heading[1-6])$/i.test(style);
      const isList = /<w:numPr\b|<w:ilvl\b|<w:numId\b/.test(body);
      const content = body
        .replace(/<w:tab\b[^>]*\/>/g, "    ")
        .replace(/<w:br\b[^>]*\/>/g, "\n")
        .replace(/<w:cr\b[^>]*\/>/g, "\n")
        .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, "")
        .replace(/<[^>]+>/g, "");
      const decoded = decodeXml(content).replace(/[ \t]+/g, " ").trim();
      if (!decoded) continue;
      paragraphs.push(isList ? "• " + decoded : decoded);
      if (isHeading) paragraphs.push("");
    }
    // Paragraph extraction retains document order, including paragraphs in table cells.
    return normalizeExtractedText(paragraphs.join("\n"));
  }

  throw new Error("The DOCX file does not contain word/document.xml.");
}

function decodePdfString(token: string): string {
  if (token.startsWith("<")) {
    const hex = token.slice(1, -1).replace(/\s/g, "");
    const normalized = hex.length % 2 ? `${hex}0` : hex;
    const bytes = new Uint8Array(normalized.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      const units: number[] = [];
      for (let index = 2; index + 1 < bytes.length; index += 2) {
        units.push((bytes[index] << 8) | bytes[index + 1]);
      }
      let decoded = "";
      for (let offset = 0; offset < units.length; offset += 8192) {
        decoded += String.fromCharCode(...units.slice(offset, offset + 8192));
      }
      return decoded;
    }
    return new TextDecoder("windows-1252").decode(bytes);
  }

  let output = "";
  for (let index = 1; index < token.length - 1; index += 1) {
    const character = token[index];
    if (character !== "\\") {
      output += character;
      continue;
    }
    const next = token[++index];
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "\n") continue;
    else if (next === "\r") {
      if (token[index + 1] === "\n") index += 1;
    } else if (/[0-7]/.test(next ?? "")) {
      let octal = next;
      for (let count = 0; count < 2 && /[0-7]/.test(token[index + 1] ?? ""); count += 1) {
        octal += token[++index];
      }
      output += String.fromCharCode(Number.parseInt(octal, 8));
    } else {
      output += next ?? "";
    }
  }
  return output;
}

function extractPdfTextFromContent(content: string): string[] {
  type PositionedText = { text: string; x: number; y: number; order: number };
  const positioned: PositionedText[] = [];
  const blocks = content.match(/BT[\s\S]*?ET/g) ?? [];
  const n = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)";
  const tokenPattern = new RegExp(
    "(" + n + ")\\s+(" + n + ")\\s+(" + n + ")\\s+(" + n + ")\\s+(" + n + ")\\s+(" + n + ")\\s+Tm|(" + n + ")\\s+(" + n + ")\\s+Td|(" + n + ")\\s+(" + n + ")\\s+TD|(" + n + ")\\s+TL|(" + n + ")\\s+Tf|(\\((?:\\\\.|[^\\\\)])*\\)|<[\\da-f\\s]*>)\\s*Tj|\\[([\\s\\S]*?)\\]\\s*TJ|(\\*)",
    "gi",
  );
  let order = 0;
  for (const block of blocks) {
    let x = 0, y = 0, lineX = 0, lineY = 0, leading = 0, fontSize = 10;
    for (const match of block.matchAll(tokenPattern)) {
      if (match[1] !== undefined) { lineX = x = Number(match[5]); lineY = y = Number(match[6]); }
      else if (match[7] !== undefined) { lineX += Number(match[7]); lineY += Number(match[8]); x = lineX; y = lineY; }
      else if (match[9] !== undefined) { const tx = Number(match[9]), ty = Number(match[10]); leading = -ty; lineX += tx; lineY += ty; x = lineX; y = lineY; }
      else if (match[11] !== undefined) leading = Number(match[11]);
      else if (match[12] !== undefined) fontSize = Math.abs(Number(match[12])) || fontSize;
      else if (match[13] !== undefined) {
        const text = decodePdfString(match[13]);
        if (text.trim()) positioned.push({ text, x, y, order: order++ });
        x += text.length * fontSize * 0.48;
      } else if (match[14] !== undefined) {
        const tokens = match[14].match(/\\((?:\\\\.|[^\\\\)])*\\)|<[\\da-f\\s]*>|[-+]?(?:\\d+\\.?\\d*|\\.\\d+)/gi) ?? [];
        let combined = "";
        const startX = x;
        for (const token of tokens) {
          if (/^(?:\\(|<)/.test(token)) { const decoded = decodePdfString(token); combined += decoded; x += decoded.length * fontSize * 0.48; }
          else x -= Number(token) / 1000 * fontSize;
        }
        if (combined.trim()) positioned.push({ text: combined, x: startX, y, order: order++ });
      } else if (match[15] !== undefined) {
        lineY -= leading || fontSize * 1.2;
        x = lineX;
        y = lineY;
      }
    }
  }
  if (!positioned.length) return [];
  const lines: { y: number; fragments: PositionedText[] }[] = [];
  for (const fragment of positioned.sort((a, b) => b.y - a.y || a.x - b.x || a.order - b.order)) {
    let line = lines.find((candidate) => Math.abs(candidate.y - fragment.y) <= 2.5);
    if (!line) { line = { y: fragment.y, fragments: [] }; lines.push(line); }
    line.fragments.push(fragment);
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => line.fragments
    .sort((a, b) => a.x - b.x || a.order - b.order).map((fragment) => fragment.text).join(" ").trim())
    .filter(Boolean);
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; skippedStreams: number }> {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (!binary.startsWith("%PDF-")) throw new Error("The PDF header is invalid.");

  const chunks: string[] = [];
  let totalCharacters = 0;
  let skippedStreams = 0;
  const streamPattern = /(<<[\s\S]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of binary.matchAll(streamPattern)) {
    const dictionary = match[1];
    const raw = match[2];
    let content = raw;

    if (/\/FlateDecode\b/.test(dictionary)) {
      const streamBytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
      try {
        content = new TextDecoder("windows-1252").decode(await decompress(streamBytes, "deflate"));
      } catch {
        skippedStreams += 1;
        continue;
      }
    } else if (/\/Filter\b/.test(dictionary)) {
      skippedStreams += 1;
      continue;
    }

    for (const text of extractPdfTextFromContent(content)) {
      chunks.push(text);
      totalCharacters += text.length;
      if (totalCharacters >= MAX_EXTRACTED_CHARS) break;
    }
    if (totalCharacters >= MAX_EXTRACTED_CHARS) break;
  }

  return {
    text: normalizeExtractedText(chunks.join("\n")),
    skippedStreams,
  };
}

export async function extractResumeText(
  bytes: Uint8Array,
  contentType: string,
): Promise<ResumeExtractionResult> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("The resume file is empty or exceeds the 10 MB extraction limit.");
  }

  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await extractDocx(bytes);
    if (!text) throw new Error("No readable text was found in the DOCX document.");
    return { text, method: "docx-xml" };
  }

  if (contentType === "application/pdf") {
    const extraction = await extractPdf(bytes);
    const text = extraction.text;
    if (!text) {
      throw new Error("No extractable text was found. This PDF may be scanned, image-only, or use unsupported font encoding; OCR is not available in this local extractor.");
    }
    return {
      text,
      method: "pdf-text",
      warning: [
        "PDF extraction is a best-effort first pass. Scanned pages need OCR, and complex font encodings or multi-column layouts may be incomplete or appear in the wrong reading order. Verify every extracted field and its order against the original.",
        extraction.skippedStreams > 0
          ? `${extraction.skippedStreams} PDF stream(s) used unsupported filters or could not be decompressed; content from those streams may be missing.`
          : "",
      ].filter(Boolean).join(" "),
    };
  }

  throw new Error("Only PDF and DOCX resumes can be extracted.");
}
