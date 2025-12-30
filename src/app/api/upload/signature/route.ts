/**
 * Upload Signature API Route
 * =============================================================================
 * POST /api/upload/signature - Generate signed upload params for Cloudinary
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { successResponse, validationErrorResponse } from '@/lib/api-utils';
import { generateUploadSignature, getUploadFolder, isAllowedFileType, getMaxFileSize } from '@/lib/cloudinary';
import { z } from 'zod';

const signatureRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  type: z.enum(['message', 'avatar', 'workspace-icon', 'dm']),
  workspaceId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
});

/**
 * POST /api/upload/signature
 *
 * Generate a signed upload signature for direct browser-to-Cloudinary uploads.
 * This ensures uploads are authenticated without proxying through our server.
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = signatureRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { filename, mimeType, fileSize, type, workspaceId, channelId } = parseResult.data;

  // Validate file type
  if (!isAllowedFileType(mimeType)) {
    return successResponse(
      { error: 'File type not allowed' },
      400
    );
  }

  // Validate file size
  const maxSize = getMaxFileSize(mimeType);
  if (fileSize > maxSize) {
    return successResponse(
      { error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB` },
      400
    );
  }

  // Validate workspace context for message uploads
  if (type === 'message' && !workspaceId) {
    return successResponse(
      { error: 'Workspace ID required for message attachments' },
      400
    );
  }

  // Generate folder path
  const folder = getUploadFolder({
    workspaceId,
    channelId,
    userId,
    type,
  });

  // Generate unique public ID
  const timestamp = Date.now();
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100);
  const publicId = `${timestamp}_${sanitizedFilename}`;

  // Generate signature
  const signatureData = generateUploadSignature({
    folder,
    publicId,
  });

  return successResponse({
    ...signatureData,
    folder,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/auto/upload`,
  });
}
