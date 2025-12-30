/**
 * Cloudinary Configuration & Utilities
 * =============================================================================
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// File type configurations
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
};

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.image,
  ...ALLOWED_FILE_TYPES.video,
  ...ALLOWED_FILE_TYPES.audio,
  ...ALLOWED_FILE_TYPES.document,
  ...ALLOWED_FILE_TYPES.archive,
];

// Max file sizes by type (in bytes)
export const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 50 * 1024 * 1024, // 50MB
  document: 25 * 1024 * 1024, // 25MB
  archive: 50 * 1024 * 1024, // 50MB
  default: 50 * 1024 * 1024, // 50MB
};

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): keyof typeof ALLOWED_FILE_TYPES | 'other' {
  for (const [category, types] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (types.includes(mimeType)) {
      return category as keyof typeof ALLOWED_FILE_TYPES;
    }
  }
  return 'other';
}

/**
 * Get max file size for a MIME type
 */
export function getMaxFileSize(mimeType: string): number {
  const category = getFileCategory(mimeType);
  return MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;
}

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALL_ALLOWED_TYPES.includes(mimeType);
}

/**
 * Generate a signed upload signature
 */
export function generateUploadSignature(params: {
  folder: string;
  publicId?: string;
  timestamp?: number;
  transformation?: string;
  eager?: string;
}): { signature: string; timestamp: number; apiKey: string; cloudName: string } {
  const timestamp = params.timestamp || Math.round(Date.now() / 1000);

  const paramsToSign: Record<string, string | number> = {
    folder: params.folder,
    timestamp,
  };

  if (params.publicId) {
    paramsToSign.public_id = params.publicId;
  }

  if (params.transformation) {
    paramsToSign.transformation = params.transformation;
  }

  if (params.eager) {
    paramsToSign.eager = params.eager;
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  };
}

/**
 * Generate optimized image URL
 */
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
    quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
    format?: 'auto' | 'webp' | 'png' | 'jpg';
  } = {}
): string {
  const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = options;

  return cloudinary.url(publicId, {
    transformation: [
      {
        width,
        height,
        crop,
        quality,
        fetch_format: format,
      },
    ],
  });
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFile(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Failed to delete file from Cloudinary:', error);
    return false;
  }
}

/**
 * Delete multiple files from Cloudinary
 */
export async function deleteFiles(publicIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const publicId of publicIds) {
    const success = await deleteFile(publicId);
    if (success) {
      deleted.push(publicId);
    } else {
      failed.push(publicId);
    }
  }

  return { deleted, failed };
}

/**
 * Get folder path for uploads based on context
 */
export function getUploadFolder(context: {
  workspaceId?: string;
  channelId?: string;
  userId: string;
  type: 'message' | 'avatar' | 'workspace-icon' | 'dm';
}): string {
  const { workspaceId, channelId, userId, type } = context;

  switch (type) {
    case 'avatar':
      return `connectnow/avatars/${userId}`;
    case 'workspace-icon':
      return `connectnow/workspaces/${workspaceId}/icon`;
    case 'message':
      if (channelId) {
        return `connectnow/workspaces/${workspaceId}/channels/${channelId}`;
      }
      return `connectnow/workspaces/${workspaceId}/messages`;
    case 'dm':
      return `connectnow/dms/${userId}`;
    default:
      return `connectnow/uploads/${userId}`;
  }
}

/**
 * Extract public ID from Cloudinary URL
 */
export function extractPublicId(url: string): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !url.includes(cloudName)) {
    return null;
  }

  // Match pattern: /v{version}/{folder}/{publicId}.{ext}
  const match = url.match(/\/v\d+\/(.+)\.\w+$/);
  return match ? match[1] : null;
}
