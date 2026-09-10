import { BadRequestException, Injectable } from '@nestjs/common';
import { supabase } from '../config/supabase';
type UploadedMediaFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class MediaService {
  async upload(userId: string, file: UploadedMediaFile) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    const fileExtension = file.originalname.split('.').pop();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.${fileExtension}`;

    const storagePath = `uploads/${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(uploadError.message);
    }

    const { data, error: dbError } = await supabase
      .from('media_files')
      .insert({
        owner_id: userId,
        storage_path: storagePath,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage
        .from('media')
        .remove([storagePath]);

      throw new BadRequestException(dbError.message);
    }

    return {
      success: true,
      message: 'File uploaded successfully.',
      data,
    };
  }
  async getMediaUrl(userId: string, mediaId: string) {
  // 1. Find the media
  const { data: media, error: mediaError } = await supabase
    .from('media_files')
    .select(`
      id,
      owner_id,
      storage_path,
      original_name,
      mime_type
    `)
    .eq('id', mediaId)
    .single();

  if (mediaError || !media) {
    throw new BadRequestException('Media not found.');
  }

  // 2. Owner can access their own media
  let allowed = media.owner_id === userId;

  // 3. If not owner, check whether the media belongs
  //    to a message in a conversation the user belongs to
  if (!allowed) {
    const { data: attachments, error: attachmentError } =
      await supabase
        .from('message_media')
        .select(`
          message_id,
          messages!inner (
            conversation_id
          )
        `)
        .eq('media_id', mediaId);

    if (attachmentError) {
      throw new BadRequestException(
        attachmentError.message,
      );
    }

    const conversationIds = (attachments ?? [])
      .map((item: any) => item.messages?.conversation_id)
      .filter(Boolean);

    if (conversationIds.length > 0) {
      const { data: membership, error: membershipError } =
        await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', userId)
          .in('conversation_id', conversationIds)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw new BadRequestException(
          membershipError.message,
        );
      }

      allowed = !!membership;
    }
  }

  // 4. Reject unauthorized access
  if (!allowed) {
    throw new BadRequestException(
      'You are not allowed to access this media.',
    );
  }

  // 5. Generate temporary signed URL
  const { data: signedUrlData, error: signedUrlError } =
    await supabase.storage
      .from('media')
      .createSignedUrl(
        media.storage_path,
        60 * 60,
      );

  if (signedUrlError || !signedUrlData) {
    throw new BadRequestException(
      signedUrlError?.message ??
        'Could not generate media URL.',
    );
  }

  return {
    success: true,
    data: {
      id: media.id,
      originalName: media.original_name,
      mimeType: media.mime_type,
      url: signedUrlData.signedUrl,
      expiresIn: 3600,
    },
  };
}
}