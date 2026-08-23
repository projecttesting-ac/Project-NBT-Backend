import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

@Injectable()
export class FriendsService {
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
  ) {
    // 1. Cannot send request to yourself
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself.',
      );
    }

    // 2. Check receiver exists
    const { data: receiver, error: receiverError } =
      await supabase
        .from('users')
        .select('id')
        .eq('id', receiverId)
        .maybeSingle();

    if (receiverError) {
      throw new BadRequestException(
        receiverError.message,
      );
    }

    if (!receiver) {
      throw new BadRequestException(
        'User not found.',
      );
    }

    // 3. Check if already friends
    const { data: friendship, error: friendshipError } =
      await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`,
        )
        .maybeSingle();

    if (friendshipError) {
      throw new BadRequestException(
        friendshipError.message,
      );
    }

    if (friendship) {
      throw new ConflictException(
        'You are already friends with this user.',
      );
    }

    // 4. Check if a pending request already exists
    //    in either direction
    const {
      data: existingRequest,
      error: requestError,
    } = await supabase
      .from('friend_requests')
      .select(
        'id, sender_id, receiver_id, status',
      )
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId},status.eq.pending),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId},status.eq.pending)`,
      )
      .maybeSingle();

    if (requestError) {
      throw new BadRequestException(
        requestError.message,
      );
    }

    if (existingRequest) {
      if (
        existingRequest.sender_id === senderId
      ) {
        throw new ConflictException(
          'Friend request already sent.',
        );
      }

      throw new ConflictException(
        'This user has already sent you a friend request.',
      );
    }

    // 5. Create friend request
    const {
      data: request,
      error: insertError,
    } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(
        insertError.message,
      );
    }

    return {
      success: true,
      message:
        'Friend request sent successfully.',
      request,
    };
  }
  async getReceivedRequests(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      sender_id,
      status,
      created_at,
      sender:users!friend_requests_sender_fkey (
        id,
        username,
        display_name,
        avatar_url,
        city
      )
    `)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    requests: data ?? [],
  };
}
}