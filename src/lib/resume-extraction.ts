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
      : "\\uFFFD";
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
    .replace(/[\t ]+\n/g, "\n")
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
    const text = xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<[^>]+>/g, "");
    return normalizeExtractedText(decodeXml(text));
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
  const results: string[] = [];
  const textBlocks = content.match(/BT[\s\S]*?ET/g) ?? [];
  const tokenPattern = /\((?:\\.|[^\\)])*\)|<[\da-f\s]*>/gi;

  for (const block of textBlocks) {
    const singleTextPattern = /(\((?:\\.|[^\\)])*\)|<[\da-f\s]*>)\s*Tj\b/gi;
    for (const match of block.matchAll(singleTextPattern)) {
      results.push(decodePdfString(match[1]));
    }

    const arrayPattern = /\[([\s\S]*?)\]\s*TJ\b/gi;
    for (const match of block.matchAll(arrayPattern)) {
      for (const token of match[1].matchAll(tokenPattern)) {
        results.push(decodePdfString(token[0]));
      }
    }
  }
  return results;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (!binary.startsWith("%PDF-")) throw new Error("The PDF header is invalid.");

  const chunks: string[] = [];
  let totalCharacters = 0;
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
        continue;
      }
    } else if (/\/Filter\b/.test(dictionary)) {
      continue;
    }

    for (const text of extractPdfTextFromContent(content)) {
      chunks.push(text);
      totalCharacters += text.length;
      if (totalCharacters >= MAX_EXTRACTED_CHARS) break;
    }
    if (totalCharacters >= MAX_EXTRACTED_CHARS) break;
  }

  return normalizeExtractedText(chunks.join("\n"));
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
    const text = await extractPdf(bytes);
    if (!text) {
      throw new Error("No extractable text was found. This PDF may be scanned, image-only, or use unsupported font encoding; OCR is not available in this local extractor.");
    }
    return {
      text,
      method: "pdf-text",
      warning: "PDF extraction is best-effort. Scanned pages, complex font encodings, and some compressed PDF structures may not be readable. Verify every extracted field against the original.",
    };
  }

  throw new Error("Only PDF and DOCX resumes can be extracted.");
}
