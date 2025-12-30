/**
 * File Upload Component
 * =============================================================================
 * Drag-and-drop file upload with preview and progress
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Paperclip, X, Upload, FileIcon, Image, Film, Music, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useFileUpload, formatFileSize, isValidFileType } from '@/hooks/useFileUpload';

interface FileUploadProps {
  type: 'message' | 'avatar' | 'workspace-icon' | 'dm';
  workspaceId?: string;
  channelId?: string;
  onUploadComplete?: (results: UploadedFile[]) => void;
  onUploadStart?: () => void;
  maxFiles?: number;
  accept?: string;
  className?: string;
  compact?: boolean;
}

interface UploadedFile {
  publicId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export function FileUpload({
  type,
  workspaceId,
  channelId,
  onUploadComplete,
  onUploadStart,
  maxFiles = 10,
  accept,
  className,
  compact = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const { uploads, isUploading, uploadFiles, cancelUpload, clearAll } = useFileUpload({
    type,
    workspaceId,
    channelId,
    onSuccess: (result) => {
      // Check if all uploads are complete
      const allComplete = uploads.every(
        (u) => u.status === 'success' || u.status === 'error'
      );
      if (allComplete && onUploadComplete) {
        const successfulUploads = uploads
          .filter((u) => u.status === 'success' && u.result)
          .map((u) => ({
            publicId: u.result!.publicId,
            url: u.result!.url,
            filename: u.result!.filename,
            mimeType: u.result!.mimeType,
            size: u.result!.size,
            width: u.result!.width,
            height: u.result!.height,
          }));
        onUploadComplete(successfulUploads);
      }
    },
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer.files).slice(0, maxFiles);
      const validFiles = files.filter((f) => isValidFileType(f));

      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
      }
    },
    [maxFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files).slice(0, maxFiles) : [];
      const validFiles = files.filter((f) => isValidFileType(f));

      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [maxFiles]
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    onUploadStart?.();
    await uploadFiles(selectedFiles);
    setSelectedFiles([]);
  }, [selectedFiles, uploadFiles, onUploadStart]);

  const handleRemoveFile = useCallback((file: File) => {
    setSelectedFiles((prev) => prev.filter((f) => f !== file));
  }, []);

  const handleCancelUpload = useCallback(() => {
    clearAll();
    setSelectedFiles([]);
  }, [clearAll]);

  const getFileTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType.startsWith('video/')) return <Film className="h-4 w-4" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    if (mimeType.includes('pdf') || mimeType.includes('document'))
      return <FileText className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  // Compact mode - just a button
  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>
      </>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files, up to 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedFiles([])}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                {/* Preview */}
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    getFileTypeIcon(file.type)
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveFile(file)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Uploading...</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelUpload}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <div
                key={`upload-${index}`}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  {getFileTypeIcon(upload.file.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">
                      {upload.file.name}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {upload.progress}%
                    </span>
                  </div>
                  <Progress value={upload.progress} className="h-1" />
                  {upload.status === 'error' && (
                    <p className="text-xs text-destructive">{upload.error}</p>
                  )}
                </div>

                {upload.status === 'uploading' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => cancelUpload(upload.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
