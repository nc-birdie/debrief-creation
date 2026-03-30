import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectFileType } from "@/lib/file-types";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const sources = await prisma.source.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(sources);
}

// Add source by file path (JSON body)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const contentType = req.headers.get("content-type") ?? "";

  // Handle multipart file upload
  if (contentType.includes("multipart/form-data")) {
    return handleFileUpload(req, campaignId);
  }

  // Handle JSON body (file path or folder path)
  const body = await req.json();

  // Folder mode: scan and add all readable files
  if (body.folderPath) {
    return handleFolderScan(body.folderPath, campaignId);
  }

  // Single file by path
  const { name, filePath, fileType } = body;

  if (!filePath) {
    return NextResponse.json(
      { error: "filePath is required" },
      { status: 400 }
    );
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `File not found: ${filePath}` },
      { status: 400 }
    );
  }

  const stats = fs.statSync(filePath);
  const fileName = name || path.basename(filePath);
  const detectedType = fileType || detectFileType(filePath);

  const source = await prisma.source.create({
    data: {
      campaignId,
      name: fileName,
      filePath: path.resolve(filePath),
      fileType: detectedType,
      sizeBytes: stats.size,
    },
  });

  return NextResponse.json(source, { status: 201 });
}

async function handleFileUpload(req: Request, campaignId: string) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Get campaign slug for storage directory
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const uploadDir = path.join(
    process.cwd(),
    "data",
    "campaigns",
    campaign.slug,
    "sources"
  );
  fs.mkdirSync(uploadDir, { recursive: true });

  const created = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadDir, safeName);

    // Avoid overwriting: append suffix if file exists
    let finalPath = filePath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      finalPath = path.join(uploadDir, `${base}_${counter}${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, buffer);

    const detectedType = detectFileType(file.name);
    const source = await prisma.source.create({
      data: {
        campaignId,
        name: file.name,
        filePath: finalPath,
        fileType: detectedType,
        sizeBytes: buffer.length,
      },
    });
    created.push(source);
  }

  return NextResponse.json(created, { status: 201 });
}

// Recursively scan supported files (max depth 3)
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
]);

function scanFolder(
  dirPath: string,
  depth: number = 0,
  maxDepth: number = 3
): string[] {
  if (depth > maxDepth) return [];
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        results.push(...scanFolder(fullPath, depth + 1, maxDepth));
      }
    } else if (entry.isFile()) {
      // Only include files with recognized extensions
      const ext = path.extname(entry.name).toLowerCase();
      if (ext && detectFileType(entry.name) !== "text") {
        // Has a known extension mapping
        results.push(fullPath);
      } else if (
        [".txt", ".md", ".csv", ".json", ".pdf"].includes(ext)
      ) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function handleFolderScan(folderPath: string, campaignId: string) {
  const resolved = path.resolve(folderPath);

  if (!fs.existsSync(resolved)) {
    return NextResponse.json(
      { error: `Folder not found: ${resolved}` },
      { status: 400 }
    );
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return NextResponse.json(
      { error: `Not a directory: ${resolved}` },
      { status: 400 }
    );
  }

  const files = scanFolder(resolved);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No readable files found in this folder" },
      { status: 400 }
    );
  }

  // Check for existing sources to avoid duplicates
  const existing = await prisma.source.findMany({
    where: { campaignId },
    select: { filePath: true },
  });
  const existingPaths = new Set(existing.map((s) => s.filePath));

  const created = [];
  let skipped = 0;

  for (const filePath of files) {
    if (existingPaths.has(filePath)) {
      skipped++;
      continue;
    }

    const stats = fs.statSync(filePath);
    const source = await prisma.source.create({
      data: {
        campaignId,
        name: path.basename(filePath),
        filePath,
        fileType: detectFileType(filePath),
        sizeBytes: stats.size,
      },
    });
    created.push(source);
  }

  return NextResponse.json(
    { added: created.length, skipped, sources: created },
    { status: 201 }
  );
}
