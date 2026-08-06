import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

@Injectable()
export class ConversationsService {
  async getConversations(userId: string) {
    // Get all conversations of the logged-in user
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
      // Get conversation details
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

      // Find the other participant
      const {
        data: otherMember,
        error: memberError,
      } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', membership.conversation_id)
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
          .select(
            'id, display_name, username, avatar_url',
          )
          .eq('id', otherMember.user_id)
          .single();

        if (!userError) {
          user = otherUser;
        }
      }
// Get unread message count
const {
  count: unreadCount,
} = await supabase
  .from('messages')
  .select('*', {
    count: 'exact',
    head: true,
  })
  .eq('conversation_id', membership.conversation_id)
  .eq('is_read', false)
  .neq('sender_id', userId);
      // Get last message
      const {
  data: lastMessage,
} = await supabase
  .from('messages')
  .select('content, created_at')
  .eq('conversation_id', membership.conversation_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

      conversations.push({
  id: conversation.id,
  type: conversation.type,
  user,
  lastMessage: lastMessage?.content ?? null,
  lastMessageTime: lastMessage?.created_at ?? null,
  unreadCount: unreadCount ?? 0,
});
    }

    return {
      success: true,
      conversations,
    };
  }
}