"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

interface CsvUploadProps {
    onUploadSuccess: () => void;
}

export default function CsvUpload({ onUploadSuccess }: CsvUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".csv")) {
            alert("Please upload a CSV file.");
            return;
        }

        setFileName(file.name);
        setIsUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await apiFetch("/datasets/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Upload failed");
            }

            // Success
            onUploadSuccess();
            // Reset after short delay
            setTimeout(() => {
                setFileName(null);
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }, 2000);

        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to upload CSV. See console for details.");
            setIsUploading(false);
            setFileName(null);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <button
                onClick={handleButtonClick}
                disabled={isUploading}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm",
                    isUploading
                        ? "bg-secondary text-secondary-foreground cursor-wait"
                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                )}
            >
                {isUploading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                    </>
                ) : fileName ? (
                    <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Uploaded
                    </>
                ) : (
                    <>
                        <Upload className="w-4 h-4" />
                        Upload CSV
                    </>
                )}
            </button>
            {fileName && isUploading && (
                <span className="text-xs text-muted-foreground animate-pulse">
                    Processing {fileName}...
                </span>
            )}
        </div>
    );
}
