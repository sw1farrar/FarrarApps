"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitPortalBrief } from "@/lib/data/portal-briefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PortalBriefForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const scope = String(formData.get("scope") || "").trim();

    const supabase = createClient();
    const uploaded: { path: string; name: string; type: string; size: number }[] =
      [];

    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        customer_id: customerId,
        name,
        scope,
        status: "planning",
      })
      .select("id")
      .single();

    if (error || !created) {
      setPending(false);
      toast.error(error?.message || "Could not submit brief");
      return;
    }

    for (const file of files) {
      const path = `${created.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file);
      if (uploadError) {
        toast.error(uploadError.message);
        continue;
      }
      uploaded.push({
        path,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      await supabase.from("project_files").insert({
        project_id: created.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    await submitPortalBrief({
      projectId: created.id,
      customerId,
      name,
      fileCount: uploaded.length,
    });

    setPending(false);
    toast.success("Brief submitted");
    (e.target as HTMLFormElement).reset();
    setFiles([]);
    router.refresh();
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Submit a project brief</CardTitle>
        <CardDescription className="text-xs">
          Share scope and supporting files for new work.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope / details</Label>
            <Textarea id="scope" name="scope" rows={5} required />
          </div>
          <div className="space-y-1.5">
            <Label>Files</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="size-4" />
              {files.length
                ? `${files.length} file(s) selected`
                : "Upload images, PDFs, or schematics"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  setFiles(e.target.files ? Array.from(e.target.files) : [])
                }
              />
            </label>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit brief
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
