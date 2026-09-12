import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // =========================================================
  // SEND FRIEND REQUEST
  // =========================================================

  async sendFriendRequest(
    senderId: string,
    receiverId: string,
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself.',
      );
    }

    // Check receiver exists
    const {
      data: receiver,
      error: receiverError,
    } = await supabase
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

    // Check already friends
    const {
      data: friendship,
      error: friendshipError,
    } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`,
      )
      .limit(1)
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

    // Check pending request in either direction
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

    // Create request
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

    // Create notification for receiver
    try {
      await this.notificationsService.createNotification(
        receiverId,
        'FRIEND_REQUEST',
        'New friend request',
        'You received a new friend request.',
        senderId,
        request.id,
        'friend_request',
      );
    } catch (notificationError) {
      // The friend request itself was successful.
      // Notification failure should not fail the request.
      console.error(
        'Failed to create friend request notification:',
        notificationError,
      );
    }

    return {
      success: true,
      message:
        'Friend request sent successfully.',
      request,
    };
  }

  // ===========================================================
  // GET RECEIVED REQUESTS
  // ===========================================================

  async getReceivedRequests(userId: string) {
    const {
      data: requests,
      error,
    } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        receiver_id,
        status,
        created_at,
        updated_at
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!requests || requests.length === 0) {
      return {
        success: true,
        requests: [],
      };
    }

    // Get sender profiles
    const senderIds = requests.map(
      (request) => request.sender_id,
    );

    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .in('id', senderIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    const userMap = new Map(
      (users ?? []).map((user) => [
        user.id,
        user,
      ]),
    );

    const result = requests.map(
      (request) => ({
        ...request,
        sender:
          userMap.get(request.sender_id) ?? null,
      }),
    );

    return {
      success: true,
      requests: result,
    };
  }

  // =========================================================
  // ACCEPT FRIEND REQUEST
  // =========================================================

  async acceptFriendRequest(
    userId: string,
    requestId: string,
  ) {
    const {
      data: request,
      error: requestError,
    } = await supabase
      .from('friend_requests')
      .select(
        'id, sender_id, receiver_id, status',
      )
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) {
      throw new BadRequestException(
        requestError.message,
      );
    }

    if (!request) {
      throw new BadRequestException(
        'Friend request not found.',
      );
    }

    // Only receiver can accept
    if (request.receiver_id !== userId) {
      throw new ConflictException(
        'You cannot accept this friend request.',
      );
    }

    if (request.status !== 'pending') {
      throw new ConflictException(
        'This friend request is no longer pending.',
      );
    }

    // Create first friendship
    const {
      error: firstError,
    } = await supabase
      .from('friendships')
      .insert({
        user_id: request.receiver_id,
        friend_id: request.sender_id,
      });

    if (firstError) {
      throw new BadRequestException(
        firstError.message,
      );
    }

    // Create reverse friendship
    const {
      error: secondError,
    } = await supabase
      .from('friendships')
      .insert({
        user_id: request.sender_id,
        friend_id: request.receiver_id,
      });

    if (secondError) {
      // Roll back first friendship
      await supabase
        .from('friendships')
        .delete()
        .eq(
          'user_id',
          request.receiver_id,
        )
        .eq(
          'friend_id',
          request.sender_id,
        );

      throw new BadRequestException(
        secondError.message,
      );
    }

    // Mark request accepted
    const {
      error: updateError,
    } = await supabase
      .from('friend_requests')
      .update({
        status: 'accepted',
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    // Notify original sender
    try {
      await this.notificationsService.createNotification(
        request.sender_id,
        'FRIEND_REQUEST_ACCEPTED',
        'Friend request accepted',
        'Your friend request was accepted.',
        userId,
        request.id,
        'friend_request',
      );
    } catch (notificationError) {
      // Friendship acceptance itself was successful.
      // Notification failure should not fail the action.
      console.error(
        'Failed to create friend request accepted notification:',
        notificationError,
      );
    }

    return {
      success: true,
      message:
        'Friend request accepted successfully.',
    };
  }

  // =========================================================
  // DECLINE FRIEND REQUEST
  // =========================================================

  async declineFriendRequest(
    userId: string,
    requestId: string,
  ) {
    const {
      data: request,
      error,
    } = await supabase
      .from('friend_requests')
      .select(
        'id, sender_id, receiver_id, status',
      )
      .eq('id', requestId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!request) {
      throw new BadRequestException(
        'Friend request not found.',
      );
    }

    if (request.receiver_id !== userId) {
      throw new ConflictException(
        'You cannot decline this friend request.',
      );
    }

    if (request.status !== 'pending') {
      throw new ConflictException(
        'This friend request is no longer pending.',
      );
    }

    const {
      error: updateError,
    } = await supabase
      .from('friend_requests')
      .update({
        status: 'declined',
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    return {
      success: true,
      message:
        'Friend request declined successfully.',
    };
  }

  // =========================================================
  // GET SENT REQUESTS
  // =========================================================

  async getSentRequests(userId: string) {
    const {
      data: requests,
      error,
    } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        receiver_id,
        status,
        created_at,
        updated_at
      `)
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!requests || requests.length === 0) {
      return {
        success: true,
        requests: [],
      };
    }

    const receiverIds = requests.map(
      (request) => request.receiver_id,
    );

    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .in('id', receiverIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    const userMap = new Map(
      (users ?? []).map((user) => [
        user.id,
        user,
      ]),
    );

    return {
      success: true,
      requests: requests.map(
        (request) => ({
          ...request,
          receiver:
            userMap.get(
              request.receiver_id,
            ) ?? null,
        }),
      ),
    };
  }

  // =========================================================
  // CANCEL SENT REQUEST
  // =========================================================

  async cancelFriendRequest(
    userId: string,
    requestId: string,
  ) {
    const {
      data: request,
      error,
    } = await supabase
      .from('friend_requests')
      .select(
        'id, sender_id, status',
      )
      .eq('id', requestId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!request) {
      throw new BadRequestException(
        'Friend request not found.',
      );
    }

    if (request.sender_id !== userId) {
      throw new ConflictException(
        'You cannot cancel this friend request.',
      );
    }

    if (request.status !== 'pending') {
      throw new ConflictException(
        'This friend request is no longer pending.',
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    return {
      success: true,
      message:
        'Friend request cancelled successfully.',
    };
  }

  // =========================================================
  // GET FRIENDS
  // =========================================================

  async getFriends(userId: string) {
    const {
      data: friendships,
      error,
    } = await supabase
      .from('friendships')
      .select(
        'id, user_id, friend_id, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (
      !friendships ||
      friendships.length === 0
    ) {
      return {
        success: true,
        count: 0,
        friends: [],
      };
    }

    const friendIds = friendships.map(
      (friendship) =>
        friendship.friend_id,
    );

    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .in('id', friendIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    const userMap = new Map(
      (users ?? []).map((user) => [
        user.id,
        user,
      ]),
    );

    return {
      success: true,
      count: friendIds.length,
      friends: friendships.map(
        (friendship) => ({
          friendshipId: friendship.id,
          createdAt:
            friendship.created_at,
          user:
            userMap.get(
              friendship.friend_id,
            ) ?? null,
        }),
      ),
    };
  }

  // =========================================================
  // REMOVE FRIEND
  // =========================================================

  async removeFriend(
    userId: string,
    friendId: string,
  ) {
    if (userId === friendId) {
      throw new BadRequestException(
        'Invalid friend.',
      );
    }

    const {
      data: friendship,
      error: friendshipError,
    } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();

    if (friendshipError) {
      throw new BadRequestException(
        friendshipError.message,
      );
    }

    if (!friendship) {
      throw new BadRequestException(
        'You are not friends with this user.',
      );
    }

    // Delete both directions
    const {
      error: deleteError,
    } = await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
      );

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    return {
      success: true,
      message:
        'Friend removed successfully.',
    };
  }

  // =========================================================
  // SEARCH USERS
  // =========================================================

  async searchUsers(
    userId: string,
    search: string,
  ) {
    const value = search?.trim();

    if (!value) {
      throw new BadRequestException(
        'Search text is required.',
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .neq('id', userId)
      .or(
        `username.ilike.%${value}%,display_name.ilike.%${value}%`,
      )
      .limit(20);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      users: data ?? [],
    };
  }

  // =========================================================
  // FRIEND SUGGESTIONS
  // =========================================================

  async getSuggestions(userId: string) {
    // Get current friends
    const {
      data: friendships,
      error: friendshipError,
    } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId);

    if (friendshipError) {
      throw new BadRequestException(
        friendshipError.message,
      );
    }

    const friendIds = (
      friendships ?? []
    ).map(
      (item) => item.friend_id,
    );

    // Get pending sent requests
    const {
      data: sentRequests,
      error: sentError,
    } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', userId)
      .eq('status', 'pending');

    if (sentError) {
      throw new BadRequestException(
        sentError.message,
      );
    }

    // Get pending received requests
    const {
      data: receivedRequests,
      error: receivedError,
    } = await supabase
      .from('friend_requests')
      .select('sender_id')
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (receivedError) {
      throw new BadRequestException(
        receivedError.message,
      );
    }

    const excludedIds = [
      userId,
      ...friendIds,
      ...(sentRequests ?? []).map(
        (item) => item.receiver_id,
      ),
      ...(receivedRequests ?? []).map(
        (item) => item.sender_id,
      ),
    ];

    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .not(
        'id',
        'in',
        `(${excludedIds.join(',')})`,
      )
      .limit(20);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    return {
      success: true,
      suggestions: users ?? [],
    };
  }

  // =========================================================
  // GET FRIEND STATUS
  // =========================================================

  async getFriendStatus(
    userId: string,
    otherUserId: string,
  ) {
    if (userId === otherUserId) {
      return {
        success: true,
        status: 'self',
      };
    }

    const {
      data: friendship,
      error: friendshipError,
    } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', otherUserId)
      .maybeSingle();

    if (friendshipError) {
      throw new BadRequestException(
        friendshipError.message,
      );
    }

    if (friendship) {
      return {
        success: true,
        status: 'friends',
      };
    }

    const {
      data: sentRequest,
      error: sentError,
    } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', userId)
      .eq('receiver_id', otherUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (sentError) {
      throw new BadRequestException(
        sentError.message,
      );
    }

    if (sentRequest) {
      return {
        success: true,
        status: 'request_sent',
        requestId: sentRequest.id,
      };
    }

    const {
      data: receivedRequest,
      error: receivedError,
    } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', otherUserId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (receivedError) {
      throw new BadRequestException(
        receivedError.message,
      );
    }

    if (receivedRequest) {
      return {
        success: true,
        status: 'request_received',
        requestId:
          receivedRequest.id,
      };
    }

    return {
      success: true,
      status: 'not_friends',
    };
  }

  // =========================================================
  // MUTUAL FRIENDS
  // =========================================================

  async getMutualFriends(
    userId: string,
    otherUserId: string,
  ) {
    if (userId === otherUserId) {
      return {
        success: true,
        count: 0,
        mutualFriends: [],
      };
    }

    // Get logged-in user's friends
    const {
      data: myFriendships,
      error: myFriendsError,
    } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId);

    if (myFriendsError) {
      throw new BadRequestException(
        myFriendsError.message,
      );
    }

    // Get other user's friends
    const {
      data: otherFriendships,
      error: otherFriendsError,
    } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', otherUserId);

    if (otherFriendsError) {
      throw new BadRequestException(
        otherFriendsError.message,
      );
    }

    const myFriendIds = new Set(
      (myFriendships ?? []).map(
        (friend) => friend.friend_id,
      ),
    );

    // Find common friends
    const mutualFriendIds = (
      otherFriendships ?? []
    )
      .map(
        (friend) => friend.friend_id,
      )
      .filter((friendId) =>
        myFriendIds.has(friendId),
      );

    if (mutualFriendIds.length === 0) {
      return {
        success: true,
        count: 0,
        mutualFriends: [],
      };
    }

    // Get profiles of mutual friends
    const {
      data: mutualFriends,
      error: usersError,
    } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        city,
        is_online,
        last_seen
      `)
      .in('id', mutualFriendIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    return {
      success: true,
      count: mutualFriendIds.length,
      mutualFriends: mutualFriends ?? [],
    };
  }
}