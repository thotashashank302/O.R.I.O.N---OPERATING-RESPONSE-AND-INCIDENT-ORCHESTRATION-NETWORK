"""Build a source-only ZIP from explicit project roots; never package local state."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
DIRECTORIES = ("src", "public", "scripts", "tests", "supabase", "docs")
FILES = (
    "README.md", "AGENTS.md", "CLAUDE.md", ".env.example", ".gitignore", ".nvmrc",
    "package.json", "package-lock.json", "next-env.d.ts", "next.config.ts",
    "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs",
    "playwright.config.ts", "vitest.config.ts", "vercel.json",
)
EXCLUDED_DIRS = {"node_modules", ".next", ".git", ".temp", "__pycache__", "test-results", "coverage"}


def include(path):
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_DIRS for part in relative.parts):
        return False
    if any(parent.is_symlink() for parent in (path, *path.parents)):
        return False
    return not (
        path.name == ".DS_Store"
        or (path.name.startswith(".env") and relative.as_posix() != ".env.example")
        or path.suffix in {".zip", ".log", ".pyc", ".tsbuildinfo", ".pem", ".key"}
    )


paths = [ROOT / name for name in FILES]
for directory in DIRECTORIES:
    paths.extend(path for path in (ROOT / directory).rglob("*") if path.is_file())
paths = sorted(path for path in paths if include(path))
# Fail for missing required root files rather than silently publishing an incomplete ZIP.
for name in FILES:
    if not (ROOT / name).is_file():
        raise FileNotFoundError(name)
output = ROOT / "dist" / "ORION_CLEAN_WORKING_SOURCE.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for path in paths:
        archive.write(path, path.relative_to(ROOT))
with ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise RuntimeError("Archive integrity check failed")
print(f"Created {output.relative_to(ROOT)}: {len(paths)} files, {output.stat().st_size:,} bytes")
