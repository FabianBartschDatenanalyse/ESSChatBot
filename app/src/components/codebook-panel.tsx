
"use client"

export default function CodebookPanel() {
  const codebookUrl = "https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/ESS1%20Codebook.html?alt=media&token=af96f0a6-0604-4dba-8480-322c8bd6fb12";

  return (
    <div className="flex h-[65vh] flex-col">
      <iframe
        src={codebookUrl}
        title="ESS Codebook"
        className="w-full h-full border-0 rounded-md"
      />
    </div>
  );
}
