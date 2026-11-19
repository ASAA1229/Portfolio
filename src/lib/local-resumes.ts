const resumeAssets = import.meta.glob<string>("/src/assets/resumes/**/*.{pdf,doc,docx}", {
  eager: true,
  query: "?url",
  import: "default",
});

const resumeFolderByProfile: Record<string, string> = {
  abhishek: "abhi",
  ammu: "ammu",
  bava: "bav",
  sai: "sai",
};

export type LocalResume = {
  name: string;
  url: string;
};

export function getLocalResumeOptions(
  profileId: string,
  assets: Record<string, string> = resumeAssets,
): LocalResume[] {
  const folder = resumeFolderByProfile[profileId];
  if (!folder) return [];

  return Object.entries(assets)
    .filter(([path]) => path.includes(`/assets/resumes/${folder}/`))
    .map(([path, url]) => ({ name: path.split("/").at(-1) ?? path, url }))
    .sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" }),
    );
}
