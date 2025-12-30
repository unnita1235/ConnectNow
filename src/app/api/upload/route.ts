/**
 * File Upload API Route (Server-side upload)
 * =============================================================================
 * POST /api/upload - Upload file through server (fallback for larger files)
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { successResponse, validationErrorResponse } from '@/lib/api-utils';
import { cloudinary, getUploadFolder, isAllowedFileType, getMaxFileSize, getFileCategory } from '@/lib/cloudinary';

/**
 * POST /api/upload
 *
 * Server-side file upload to Cloudinary.
 * Use this for server-to-server uploads or as fallback.
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse form data
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return successResponse({ error: 'Invalid form data' }, 400);
  }

  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;
  const workspaceId = formData.get('workspaceId') as string | null;
  const channelId = formData.get('channelId') as string | null;

  if (!file) {
    return successResponse({ error: 'No file provided' }, 400);
  }

  if (!type || !['message', 'avatar', 'workspace-icon', 'dm'].includes(type)) {
    return successResponse({ error: 'Invalid upload type' }, 400);
  }

  // Validate file type
  if (!isAllowedFileType(file.type)) {
    return successResponse({ error: 'File type not allowed' }, 400);
  }

  // Validate file size
  const maxSize = getMaxFileSize(file.type);
  if (file.size > maxSize) {
    return successResponse(
      { error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB` },
      400
    );
  }

  // Get upload folder
  const folder = getUploadFolder({
    workspaceId: workspaceId || undefined,
    channelId: channelId || undefined,
    userId,
    type: type as 'message' | 'avatar' | 'workspace-icon' | 'dm',
  });

  // Generate public ID
  const timestamp = Date.now();
  const sanitizedFilename = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100);
  const publicId = `${timestamp}_${sanitizedFilename}`;

  try {
    // Convert File to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise<{
      public_id: string;
      secure_url: string;
      format: string;
      width?: number;
      height?: number;
      bytes: number;
      resource_type: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'auto',
          // Generate thumbnails for images
          eager: getFileCategory(file.type) === 'image'
            ? [{ width: 200, height: 200, crop: 'thumb' }]
            : undefined,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!);
        }
      );
      uploadStream.end(buffer);
    });

    return successResponse({
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes,
      type: result.resource_type,
      filename: file.name,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return successResponse({ error: 'Upload failed' }, 500);
  }
}
