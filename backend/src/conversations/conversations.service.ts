import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { supabase } from '../config/supabase';
import { UpdateMessageDto } from './dto/update-message.dto';

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
    // Get all messages
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
  reply_to_message_id
`)
      .eq('conversation_id', conversationId)
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // Find the other participant
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

    return {
      success: true,
      user,
      messages: messages.map(
        (message) => ({
          id: message.id,
          senderId: message.sender_id,
          content: message.content,
          createdAt:
            message.created_at,
          isRead: message.is_read,
          replyToMessageId: message.reply_to_message_id,
        }),
      ),
    };
  }
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
  conversation_id: conversationId,
  sender_id: userId,
  content: dto.content,
  reply_to_message_id: dto.replyToMessageId ?? null,
})
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: 'Message sent successfully.',
      data,
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
}