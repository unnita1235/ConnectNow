/**
 * File Upload Hook
 * =============================================================================
 * Custom hook for handling file uploads to Cloudinary
 */

'use client';

import { useState, useCallback } from 'react';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: UploadResult;
}

interface UploadResult {
  publicId: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
  size: number;
  type: string;
  filename: string;
  mimeType: string;
}

interface UploadOptions {
  type: 'message' | 'avatar' | 'workspace-icon' | 'dm';
  workspaceId?: string;
  channelId?: string;
  onProgress?: (progress: number, file: File) => void;
  onSuccess?: (result: UploadResult, file: File) => void;
  onError?: (error: string, file: File) => void;
}

interface UseFileUploadReturn {
  uploads: UploadProgress[];
  isUploading: boolean;
  uploadFile: (file: File) => Promise<UploadResult | null>;
  uploadFiles: (files: File[]) => Promise<(UploadResult | null)[]>;
  cancelUpload: (file: File) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

/**
 * Hook for uploading files to Cloudinary
 */
export function useFileUpload(options: UploadOptions): UseFileUploadReturn {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [abortControllers] = useState(new Map<File, AbortController>());

  const { type, workspaceId, channelId, onProgress, onSuccess, onError } = options;

  /**
   * Update upload progress
   */
  const updateUpload = useCallback((file: File, updates: Partial<UploadProgress>) => {
    setUploads((prev) =>
      prev.map((u) => (u.file === file ? { ...u, ...updates } : u))
    );
  }, []);

  /**
   * Upload a single file using signed upload
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      // Add to uploads list
      setUploads((prev) => [
        ...prev,
        { file, progress: 0, status: 'pending' },
      ]);

      const controller = new AbortController();
      abortControllers.set(file, controller);

      try {
        // Get signature from our API
        updateUpload(file, { status: 'uploading', progress: 5 });

        const signatureResponse = await fetch('/api/upload/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            type,
            workspaceId,
            channelId,
          }),
          signal: controller.signal,
        });

        if (!signatureResponse.ok) {
          const errorData = await signatureResponse.json();
          throw new Error(errorData.error || 'Failed to get upload signature');
        }

        const signatureData = await signatureResponse.json();
        updateUpload(file, { progress: 10 });

        // Upload directly to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', signatureData.apiKey);
        formData.append('timestamp', signatureData.timestamp.toString());
        formData.append('signature', signatureData.signature);
        formData.append('folder', signatureData.folder);
        formData.append('public_id', signatureData.publicId);

        // Use XMLHttpRequest for progress tracking
        const result = await new Promise<UploadResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = 10 + Math.round((e.loaded / e.total) * 85);
              updateUpload(file, { progress });
              onProgress?.(progress, file);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              resolve({
                publicId: response.public_id,
                url: response.secure_url,
                format: response.format,
                width: response.width,
                height: response.height,
                size: response.bytes,
                type: response.resource_type,
                filename: file.name,
                mimeType: file.type,
              });
            } else {
              const response = JSON.parse(xhr.responseText);
              reject(new Error(response.error?.message || 'Upload failed'));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
          });

          // Listen for abort signal
          controller.signal.addEventListener('abort', () => {
            xhr.abort();
          });

          xhr.open('POST', signatureData.uploadUrl);
          xhr.send(formData);
        });

        updateUpload(file, { status: 'success', progress: 100, result });
        onSuccess?.(result, file);
        abortControllers.delete(file);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';

        if (errorMessage !== 'Upload cancelled') {
          updateUpload(file, { status: 'error', error: errorMessage });
          onError?.(errorMessage, file);
        }

        abortControllers.delete(file);
        return null;
      }
    },
    [type, workspaceId, channelId, updateUpload, onProgress, onSuccess, onError, abortControllers]
  );

  /**
   * Upload multiple files
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<(UploadResult | null)[]> => {
      return Promise.all(files.map(uploadFile));
    },
    [uploadFile]
  );

  /**
   * Cancel an in-progress upload
   */
  const cancelUpload = useCallback(
    (file: File) => {
      const controller = abortControllers.get(file);
      if (controller) {
        controller.abort();
        abortControllers.delete(file);
      }
      setUploads((prev) => prev.filter((u) => u.file !== file));
    },
    [abortControllers]
  );

  /**
   * Clear completed and errored uploads
   */
  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status === 'uploading' || u.status === 'pending'));
  }, []);

  /**
   * Clear all uploads and cancel pending
   */
  const clearAll = useCallback(() => {
    abortControllers.forEach((controller) => controller.abort());
    abortControllers.clear();
    setUploads([]);
  }, [abortControllers]);

  const isUploading = uploads.some((u) => u.status === 'uploading' || u.status === 'pending');

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    cancelUpload,
    clearCompleted,
    clearAll,
  };
}

/**
 * File validation utilities
 */
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
};

export function isValidFileType(file: File, allowedTypes?: string[]): boolean {
  const allTypes = allowedTypes || [
    ...ALLOWED_FILE_TYPES.image,
    ...ALLOWED_FILE_TYPES.video,
    ...ALLOWED_FILE_TYPES.audio,
    ...ALLOWED_FILE_TYPES.document,
  ];
  return allTypes.includes(file.type);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📎';
}
