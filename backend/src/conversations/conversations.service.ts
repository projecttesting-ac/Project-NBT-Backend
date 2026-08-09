import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { supabase } from '../config/supabase';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';

@Injectable()
export class ConversationsService {
  async getConversations(userId: string) {
    const {
      data: memberships,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    if (membershipError) {
      throw new BadRequestException(
        membershipError.message,
      );
    }

    if (!memberships || memberships.length === 0) {
      return {
        success: true,
        conversations: [],
      };
    }

    const conversations: any[] = [];

    for (const membership of memberships) {
      // Conversation details
      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', membership.conversation_id)
        .single();

      if (conversationError || !conversation) {
        continue;
      }

      // Other participant
      const {
        data: otherMember,
        error: memberError,
      } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq(
          'conversation_id',
          membership.conversation_id,
        )
        .neq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        continue;
      }

      let user: any = null;

      if (otherMember) {
        const {
          data: otherUser,
          error: userError,
        } = await supabase
          .from('users')
          .select(`
            id,
            display_name,
            username,
            avatar_url,
            is_online,
            last_seen
          `)
          .eq('id', otherMember.user_id)
          .single();

        if (!userError) {
          user = otherUser;
        }
      }

      // Last message
      const {
        data: lastMessage,
      } = await supabase
        .from('messages')
        .select(
          'content, created_at',
        )
        .eq(
          'conversation_id',
          membership.conversation_id,
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      // Unread count
      const {
        count: unreadCount,
      } = await supabase
        .from('messages')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'conversation_id',
          membership.conversation_id,
        )
        .eq('is_read', false)
        .neq('sender_id', userId);

      conversations.push({
        id: conversation.id,
        type: conversation.type,
        user,
        lastMessage:
          lastMessage?.content ?? null,
        lastMessageTime:
          lastMessage?.created_at ?? null,
        unreadCount:
          unreadCount ?? 0,
      });
    }

    return {
      success: true,
      conversations,
    };
  }
    async getMessages(
  userId: string,
  conversationId: string,
) {
  // 1. Make sure the user belongs to this conversation
  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  if (!membership) {
    throw new BadRequestException(
      'You are not a member of this conversation.',
    );
  }

  // 2. Get all messages with their media
  const {
    data: messages,
    error,
  } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      content,
      created_at,
      is_read,
      reply_to_message_id,
      message_media (
        media_id,
        media_files (
          id,
          original_name,
          mime_type,
          size_bytes,
          storage_path
        )
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    throw new BadRequestException(error.message);
  }

  // 3. Find the other participant
  const {
    data: otherMember,
    error: memberError,
  } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', userId)
    .maybeSingle();

  if (memberError) {
    throw new BadRequestException(
      memberError.message,
    );
  }

  let user: any = null;

  // 4. Get other user's profile
  if (otherMember) {
    const {
      data: otherUser,
      error: userError,
    } = await supabase
      .from('users')
      .select(`
        id,
        display_name,
        username,
        avatar_url,
        is_online,
        last_seen
      `)
      .eq('id', otherMember.user_id)
      .single();

    if (userError) {
      throw new BadRequestException(
        userError.message,
      );
    }

    user = otherUser;
  }

  // 5. Generate signed URLs for media
  const formattedMessages = await Promise.all(
    (messages ?? []).map(async (message) => {
      const media = await Promise.all(
        (message.message_media ?? []).map(
          async (attachment: any) => {
            const mediaFile = attachment.media_files;

            if (!mediaFile) {
              return {
                mediaId: attachment.media_id,
                url: null,
              };
            }

            const {
              data: signedUrlData,
              error: signedUrlError,
            } = await supabase.storage
              .from('media')
              .createSignedUrl(
                mediaFile.storage_path,
                60 * 60,
              );

            if (signedUrlError) {
              throw new BadRequestException(
                signedUrlError.message,
              );
            }

            return {
              mediaId: attachment.media_id,
              id: mediaFile.id,
              originalName: mediaFile.original_name,
              mimeType: mediaFile.mime_type,
              sizeBytes: mediaFile.size_bytes,
              url: signedUrlData?.signedUrl ?? null,
              expiresIn: 3600,
            };
          },
        ),
      );

      return {
        id: message.id,
        senderId: message.sender_id,
        content: message.content,
        createdAt: message.created_at,
        isRead: message.is_read,
        replyToMessageId: message.reply_to_message_id,
        media,
      };
    }),
  );

  // 6. Return messages
  return {
    success: true,
    user,
    messages: formattedMessages,
  };
}
  async sendMessage(
  userId: string,
  conversationId: string,
  dto: SendMessageDto,
) {
  // 1. Create the message
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: dto.content ?? '',
      reply_to_message_id: dto.replyToMessageId ?? null,
    })
    .select()
    .single();

  if (messageError) {
    throw new BadRequestException(messageError.message);
  }

  // 2. Attach media files if provided
  if (dto.mediaIds && dto.mediaIds.length > 0) {
    const attachments = dto.mediaIds.map((mediaId) => ({
      message_id: message.id,
      media_id: mediaId,
    }));

    const { error: attachmentError } = await supabase
      .from('message_media')
      .insert(attachments);

    if (attachmentError) {
      await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      throw new BadRequestException(
        attachmentError.message,
      );
    }
  }

  // 3. Get attached media
  const { data: media, error: mediaError } = await supabase
    .from('message_media')
    .select(`
      media_id,
      media_files (
        id,
        original_name,
        mime_type,
        size_bytes,
        storage_path
      )
    `)
    .eq('message_id', message.id);

  if (mediaError) {
    throw new BadRequestException(mediaError.message);
  }

  // 4. Return message + media
  return {
    success: true,
    message: 'Message sent successfully.',
    data: {
      ...message,
      media: media ?? [],
    },
  };
}
  async markMessagesAsRead(
    userId: string,
    conversationId: string,
  ) {
    const { error } = await supabase
      .from('messages')
      .update({
        is_read: true,
      })
      .eq(
        'conversation_id',
        conversationId,
      )
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Messages marked as read.',
    };
  }
  async markMessageAsDelivered(
  userId: string,
  conversationId: string,
  messageId: string,
) {
  // Make sure the user belongs to this conversation
  const { data: membership, error: membershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  if (!membership) {
    throw new BadRequestException(
      'You are not a member of this conversation.',
    );
  }

  // Mark the message as delivered
  const { data, error } = await supabase
    .from('messages')
    .update({
      delivered_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(
      error.message,
    );
  }

  return {
    success: true,
    message: 'Message marked as delivered.',
    data,
  };
}

async markMessageAsSeen(
  userId: string,
  conversationId: string,
  messageId: string,
) {
  // Make sure the user belongs to this conversation
  const { data: membership, error: membershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  if (!membership) {
    throw new BadRequestException(
      'You are not a member of this conversation.',
    );
  }

  // Mark the message as seen
  const { data, error } = await supabase
    .from('messages')
    .update({
      delivered_at: new Date().toISOString(),
      seen_at: new Date().toISOString(),
      is_read: true,
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(
      error.message,
    );
  }

  return {
    success: true,
    message: 'Message marked as seen.',
    data,
  };
}
async updateMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  dto: UpdateMessageDto,
) {
  // Verify that the user belongs to the conversation
  const { data: membership, error: membershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  if (!membership) {
    throw new BadRequestException(
      'You are not a member of this conversation.',
    );
  }

  // Update only the user's own message
  const { data, error } = await supabase
    .from('messages')
    .update({
      content: dto.content,
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(
      error.message,
    );
  }

  return {
    success: true,
    message: 'Message updated successfully.',
    data,
  };
}
async deleteMessage(
  userId: string,
  conversationId: string,
  messageId: string,
) {
  // Make sure the user belongs to this conversation
  const { data: membership, error: membershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  if (!membership) {
    throw new BadRequestException(
      'You are not a member of this conversation.',
    );
  }

  // Delete only the user's own message
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(
      error.message,
    );
  }

  return {
    success: true,
    message: 'Message deleted successfully.',
    data,
  };
}
async forwardMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  dto: ForwardMessageDto,
) {
  // 1. Check that the user belongs to the source conversation
  const { data: sourceMembership, error: sourceMembershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (sourceMembershipError) {
    throw new BadRequestException(
      sourceMembershipError.message,
    );
  }

  if (!sourceMembership) {
    throw new BadRequestException(
      'You are not a member of the source conversation.',
    );
  }

  // 2. Get the original message
  const { data: originalMessage, error: messageError } =
    await supabase
      .from('messages')
      .select(`
        id,
        content,
        message_media (
          media_id
        )
      `)
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

  if (messageError) {
    throw new BadRequestException(
      messageError.message,
    );
  }

  if (!originalMessage) {
    throw new BadRequestException(
      'Message not found.',
    );
  }

  // 3. Check that the user belongs to the target conversation
  const { data: targetMembership, error: targetMembershipError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', dto.targetConversationId)
      .eq('user_id', userId)
      .maybeSingle();

  if (targetMembershipError) {
    throw new BadRequestException(
      targetMembershipError.message,
    );
  }

  if (!targetMembership) {
    throw new BadRequestException(
      'You are not a member of the target conversation.',
    );
  }

  // 4. Create the new message
  const { data: forwardedMessage, error: insertError } =
    await supabase
      .from('messages')
      .insert({
        conversation_id: dto.targetConversationId,
        sender_id: userId,
        content: originalMessage.content ?? '',
      })
      .select()
      .single();

  if (insertError) {
    throw new BadRequestException(
      insertError.message,
    );
  }

  // 5. Forward the attached media
  const mediaAttachments = originalMessage.message_media ?? [];

  if (mediaAttachments.length > 0) {
    const attachments = mediaAttachments.map(
      (attachment: any) => ({
        message_id: forwardedMessage.id,
        media_id: attachment.media_id,
      }),
    );

    const { error: mediaError } = await supabase
      .from('message_media')
      .insert(attachments);

    if (mediaError) {
      // Remove the newly created message if media attachment fails
      await supabase
        .from('messages')
        .delete()
        .eq('id', forwardedMessage.id);

      throw new BadRequestException(
        mediaError.message,
      );
    }
  }

  // 6. Get forwarded media details
  const { data: media, error: mediaFetchError } =
    await supabase
      .from('message_media')
      .select(`
        media_id,
        media_files (
          id,
          original_name,
          mime_type,
          size_bytes,
          storage_path
        )
      `)
      .eq('message_id', forwardedMessage.id);

  if (mediaFetchError) {
    throw new BadRequestException(
      mediaFetchError.message,
    );
  }

  return {
    success: true,
    message: 'Message forwarded successfully.',
    data: {
      ...forwardedMessage,
      media: media ?? [],
    },
  };
}
}