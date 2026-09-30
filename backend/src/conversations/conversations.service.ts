import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { GroupMentionQueryDto } from './dto/group-mention-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMembersDto } from './dto/add-group-members.dto';
import { supabase } from '../config/supabase';
import { MediaService } from '../media/media.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly mediaService: MediaService,
  ) {}

  async createGroup(
    userId: string,
    dto: CreateGroupDto,
  ) {

    const memberIds = [
      ...new Set([
        userId,
        ...dto.memberIds,
      ]),
    ];

    // make sure all requested users exist
    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select('id')
      .in('id', memberIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    if (
      !users ||
      users.length !== memberIds.length
    ) {
      throw new BadRequestException(
        'One or more group members were not found.',
      );
    }

    // create the group conversation
    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from('conversations')
      .insert({
        type: 'group',
        name: dto.name.trim(),
        avatar_url:
          dto.avatarUrl?.trim() || null,
        created_by: userId,
      })
      .select()
      .single();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    // add the creator and selected members
    const members = memberIds.map(
      (memberId) => ({
        conversation_id: conversation.id,
        user_id: memberId,
        role:
          memberId === userId
            ? 'president'
            : 'member',
      }),
    );

    const {
      error: membersError,
    } = await supabase
      .from('conversation_members')
      .insert(members);

    if (membersError) {
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id);

      throw new BadRequestException(
        membersError.message,
      );
    }

    return {
      success: true,
      message:
        'Group created successfully.',
      conversation,
      members: memberIds,
    };
  }

  async createConversation(
    userId: string,
    targetUserId: string,
  ) {
    
    // don't allow users to message themselves
    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot create a conversation with yourself.',
      );
    }

    // check if the target user exists
    const {
      data: targetUser,
      error: targetUserError,
    } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetUserError) {
      throw new BadRequestException(
        targetUserError.message,
      );
    }

    if (!targetUser) {
      throw new BadRequestException(
        'Target user not found.',
      );
    }

    // check if a conversation already exists between both users
    const {
      data: myMemberships,
      error: myMembershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    if (myMembershipError) {
      throw new BadRequestException(
        myMembershipError.message,
      );
    }

    if (
      myMemberships &&
      myMemberships.length > 0
    ) {
      const conversationIds =
        myMemberships.map(
          (item) => item.conversation_id,
        );

      const {
        data: existingMembership,
        error: existingError,
      } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .in(
          'conversation_id',
          conversationIds,
        )
        .eq('user_id', targetUserId)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new BadRequestException(
          existingError.message,
        );
      }

      if (existingMembership) {
        return {
          success: true,
          message:
            'Conversation already exists.',
          conversationId:
            existingMembership.conversation_id,
        };
      }
    }

    // create the conversation
    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        created_by: userId,
      })
      .select()
      .single();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    // add both users to the conversation
    const { error: membersError } =
      await supabase
        .from('conversation_members')
        .insert([
          {
            conversation_id:
              conversation.id,
            user_id: userId,
          },
          {
            conversation_id:
              conversation.id,
            user_id: targetUserId,
          },
        ]);

    if (membersError) {
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id);

      throw new BadRequestException(
        membersError.message,
      );
    }

    return {
      success: true,
      message:
        'Conversation created successfully.',
      conversation,
    };
  }

  async createConversationAndSendMessage(
    userId: string,
    targetUserId: string,
    dto: SendMessageDto,
    file?: any,
  ) {
    // find an existing conversation or create one
    const conversationResult =
      await this.createConversation(
        userId,
        targetUserId,
      );

    const conversationId =
      conversationResult.conversationId ??
      conversationResult.conversation?.id;

    if (!conversationId) {
      throw new BadRequestException(
        'Could not determine conversation ID.',
      );
    }

    // send the first message
    const messageResult =
      await this.sendMessage(
        userId,
        conversationId,
        dto,
        file,
      );

    return {
      success: true,
      message:
        'Conversation ready and message sent successfully.',
      conversationId,
      conversation:
        conversationResult.conversation ??
        null,
      data: messageResult.data,
    };
  }

  async getConversations(
    userId: string,
    pagination: PaginationDto,
  ) {
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: memberships,
      error: membershipError,
      count: total,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id, role', {
        count: 'exact',
      })
      .eq('user_id', userId)
      .range(from, to);

    if (membershipError) {
      throw new BadRequestException(
        membershipError.message,
      );
    }

    if (!memberships || memberships.length === 0) {
      return {
        success: true,
        conversations: [],
        pagination: {
          page,
          limit,
          total: total ?? 0,
          totalPages:
            total && total > 0
              ? Math.ceil(total / limit)
              : 0,
          hasNextPage: false,
          hasPreviousPage: page > 1,
        },
      };
    }

    const conversations: any[] = [];

    for (const membership of memberships) {
      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select('*')
        .eq(
          'id',
          membership.conversation_id,
        )
        .single();

      if (
        conversationError ||
        !conversation
      ) {
        continue;
      }

      if (conversation.type === 'group') {
        const { count: memberCount } =
          await supabase
            .from('conversation_members')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'conversation_id',
              membership.conversation_id,
            );

        const { data: lastMessage } =
          await supabase
            .from('messages')
            .select('content, created_at')
            .eq(
              'conversation_id',
              membership.conversation_id,
            )
            .order('created_at', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        const { count: unreadCount } =
          await supabase
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
          type: 'group',
          group: {
            id: conversation.id,
            name: conversation.name,
            avatarUrl: conversation.avatar_url,
            createdBy: conversation.created_by,
            memberCount: memberCount ?? 0,
            role: membership.role ?? 'member',
          },
          user: null,
          lastMessage: lastMessage?.content ?? null,
          lastMessageTime: lastMessage?.created_at ?? null,
          unreadCount: unreadCount ?? 0,
        });

        continue;
      }

      // get the other person in the conversation
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
        .limit(1)
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
          .eq(
            'id',
            otherMember.user_id,
          )
          .single();

        if (!userError) {
          user = otherUser;
        }
      }

      // get the latest message
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

      // count unread messages
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

    const totalCount = total ?? 0;

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount / limit,
          )
        : 0;

    return {
      success: true,

      conversations,

      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },
    };
  }

  private readonly groupRoleLevel: Record<string, number> = {
    member: 1,
    volunteer: 2,
    moderator: 3,
    vice_president: 4,
    president: 5,
  };

  private canManageGroupRole(
    actorRole: string,
    targetRole: string,
  ) {
    return (
      (this.groupRoleLevel[actorRole] ?? 0) >
      (this.groupRoleLevel[targetRole] ?? 0)
    );
  }

  private async getGroupConversation(
    conversationId: string,
  ) {
    const { data: conversation, error } =
      await supabase
        .from('conversations')
        .select(
          'id, type, name, avatar_url, created_by, created_at, updated_at',
        )
        .eq('id', conversationId)
        .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!conversation) {
      throw new BadRequestException(
        'Conversation not found.',
      );
    }

    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'This action is only available for group conversations.',
      );
    }

    return conversation;
  }

  private async getGroupMembership(
    conversationId: string,
    userId: string,
  ) {
    const { data: membership, error } =
      await supabase
        .from('conversation_members')
        .select(
          'conversation_id, user_id, role, joined_at',
        )
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!membership) {
      throw new BadRequestException(
        'You are not a member of this conversation.',
      );
    }

    return membership;
  }

  private async requireGroupManager(
    conversationId: string,
    userId: string,
  ) {
    await this.getGroupConversation(conversationId);
    const membership =
      await this.getGroupMembership(
        conversationId,
        userId,
      );

    if (
      !['president', 'vice_president', 'moderator'].includes(
        membership.role,
      )
    ) {
      throw new BadRequestException(
        'You do not have permission to manage this group.',
      );
    }

    return membership;
  }

  async getGroupMentionUsers(
    userId: string,
    conversationId: string,
    dto: GroupMentionQueryDto,
  ) {
    // make sure the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // make sure this is a group conversation
    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from('conversations')
      .select('id, type')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    if (!conversation) {
      throw new BadRequestException(
        'Conversation not found.',
      );
    }

    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Mentions are only available in group conversations.',
      );
    }

    const search = String(
      dto.query ?? '',
    )
      .trim()
      .toLowerCase();

    // get group members
    const {
      data: members,
      error: membersError,
    } = await supabase
      .from('conversation_members')
      .select(`
        user_id,
        users (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq(
        'conversation_id',
        conversationId,
      );

    if (membersError) {
      throw new BadRequestException(
        membersError.message,
      );
    }

    const users = (members ?? [])
      .map((member: any) => member.users)
      .filter(Boolean)
      .filter((user: any) => {
        if (!search) {
          return true;
        }

        const username =
          String(
            user.username ?? '',
          ).toLowerCase();

        const displayName =
          String(
            user.display_name ?? '',
          ).toLowerCase();

        return (
          username.includes(search) ||
          displayName.includes(search)
        );
      })
      .slice(0, 20)
      .map((user: any) => ({
        id: user.id,
        username: user.username,
        displayName:
          user.display_name,
        avatarUrl:
          user.avatar_url,
      }));

    return {
      success: true,
      users,
    };
  }

  async getGroupMembers(
    userId: string,
    conversationId: string,
  ) {
    // make sure the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // make sure this is a group conversation
    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from('conversations')
      .select(
        'id, type, name, avatar_url, created_by',
      )
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    if (!conversation) {
      throw new BadRequestException(
        'Conversation not found.',
      );
    }

    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Members can only be viewed for group conversations.',
      );
    }

    // get all group members
    const {
      data: members,
      error: membersError,
    } = await supabase
      .from('conversation_members')
      .select(`
        user_id,
        joined_at,
        role,
        users (
          id,
          display_name,
          username,
          avatar_url,
          is_online,
          last_seen
        )
      `)
      .eq(
        'conversation_id',
        conversationId,
      )
      .order('joined_at', {
        ascending: true,
      });

    if (membersError) {
      throw new BadRequestException(
        membersError.message,
      );
    }

    const formattedMembers =
      (members ?? [])
        .map((member: any) => {
          const user = member.users;

          if (!user) {
            return null;
          }

          return {
            id: user.id,
            username: user.username,
            displayName:
              user.display_name,
            avatarUrl:
              user.avatar_url,
            isOnline:
              user.is_online,
            lastSeen:
              user.last_seen,
            joinedAt:
              member.joined_at,
            role:
              member.role ?? 'member',
            isAdmin:
              user.id ===
              conversation.created_by,
          };
        })
        .filter(Boolean);

    return {
      success: true,
      conversation: {
        id: conversation.id,
        name: conversation.name,
        avatarUrl:
          conversation.avatar_url,
        createdBy:
          conversation.created_by,
      },
      members: formattedMembers,
    };
  }
  async addGroupMembers(
    userId: string,
    conversationId: string,
    dto: AddGroupMembersDto,
  ) {
    await this.requireGroupManager(
      conversationId,
      userId,
    );

    const memberIds = [
      ...new Set(dto.memberIds),
    ].filter((memberId) => memberId !== userId);

    if (memberIds.length === 0) {
      throw new BadRequestException(
        'Please provide at least one new member.',
      );
    }

    const { data: users, error: usersError } =
      await supabase
        .from('users')
        .select(`
          id,
          display_name,
          username,
          avatar_url,
          is_online,
          last_seen
        `)
        .in('id', memberIds);

    if (usersError) {
      throw new BadRequestException(
        usersError.message,
      );
    }

    if (!users || users.length !== memberIds.length) {
      throw new BadRequestException(
        'One or more users were not found.',
      );
    }

    const {
      data: existingMembers,
      error: existingMembersError,
    } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .in('user_id', memberIds);

    if (existingMembersError) {
      throw new BadRequestException(
        existingMembersError.message,
      );
    }

    const existingIds = new Set(
      (existingMembers ?? []).map(
        (member) => member.user_id,
      ),
    );

    const usersToAdd = memberIds.filter(
      (memberId) => !existingIds.has(memberId),
    );

    if (usersToAdd.length === 0) {
      throw new BadRequestException(
        'All selected users are already members of this group.',
      );
    }

    const { error: insertError } =
      await supabase
        .from('conversation_members')
        .insert(
          usersToAdd.map((memberId) => ({
            conversation_id: conversationId,
            user_id: memberId,
            role: 'member',
          })),
        );

    if (insertError) {
      throw new BadRequestException(
        insertError.message,
      );
    }

    return {
      success: true,
      message: 'Members added successfully.',
      conversationId,
      addedMembers: (users ?? [])
        .filter((user) =>
          usersToAdd.includes(user.id),
        )
        .map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          isOnline: user.is_online,
          lastSeen: user.last_seen,
          role: 'member',
        })),
    };
  }

  async removeGroupMember(
    userId: string,
    conversationId: string,
    targetUserId: string,
  ) {
    const actor =
      await this.requireGroupManager(
        conversationId,
        userId,
      );

    if (userId === targetUserId) {
      throw new BadRequestException(
        'Use the leave-group endpoint to leave the group.',
      );
    }

    const target =
      await this.getGroupMembership(
        conversationId,
        targetUserId,
      );

    if (target.role === 'president') {
      throw new BadRequestException(
        'The president cannot be removed from the group.',
      );
    }

    if (
      !this.canManageGroupRole(
        actor.role,
        target.role,
      )
    ) {
      throw new BadRequestException(
        'You cannot remove a member with an equal or higher role.',
      );
    }

    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Member removed successfully.',
      removedUserId: targetUserId,
    };
  }

  async leaveGroup(
    userId: string,
    conversationId: string,
  ) {
    await this.getGroupConversation(conversationId);
    const membership =
      await this.getGroupMembership(
        conversationId,
        userId,
      );

    if (membership.role === 'president') {
      throw new BadRequestException(
        'The president cannot leave the group. Transfer the presidency first.',
      );
    }

    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'You left the group successfully.',
      conversationId,
    };
  }

  async updateGroupMemberRole(
    userId: string,
    conversationId: string,
    targetUserId: string,
    role: string,
  ) {
    const actor =
      await this.requireGroupManager(
        conversationId,
        userId,
      );

    const allowedRoles = [
      'president',
      'vice_president',
      'moderator',
      'volunteer',
      'member',
    ];

    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(
        'Invalid group role.',
      );
    }

    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot change your own group role.',
      );
    }

    const target =
      await this.getGroupMembership(
        conversationId,
        targetUserId,
      );

    if (target.role === 'president') {
      throw new BadRequestException(
        'The current president can only be changed through presidency transfer.',
      );
    }

    if (role === 'president') {
      if (actor.role !== 'president') {
        throw new BadRequestException(
          'Only the president can transfer the presidency.',
        );
      }

      const { error: actorError } =
        await supabase
          .from('conversation_members')
          .update({ role: 'vice_president' })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);

      if (actorError) {
        throw new BadRequestException(
          actorError.message,
        );
      }

      const { error: targetError } =
        await supabase
          .from('conversation_members')
          .update({ role: 'president' })
          .eq('conversation_id', conversationId)
          .eq('user_id', targetUserId);

      if (targetError) {
        await supabase
          .from('conversation_members')
          .update({ role: 'president' })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);
        throw new BadRequestException(
          targetError.message,
        );
      }

      return {
        success: true,
        message: 'Presidency transferred successfully.',
        targetUserId,
        role: 'president',
      };
    }

    if (
      !this.canManageGroupRole(
        actor.role,
        target.role,
      )
    ) {
      throw new BadRequestException(
        'You cannot change the role of a member with an equal or higher role.',
      );
    }

    if (
      !this.canManageGroupRole(
        actor.role,
        role,
      )
    ) {
      throw new BadRequestException(
        'You cannot assign a role equal to or higher than your own role.',
      );
    }

    const { data, error } =
      await supabase
        .from('conversation_members')
        .update({ role })
        .eq('conversation_id', conversationId)
        .eq('user_id', targetUserId)
        .select('user_id, role')
        .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Member role updated successfully.',
      data,
    };
  }

  async updateGroup(
    userId: string,
    conversationId: string,
    name?: string,
    avatarUrl?: string,
  ) {
    const actor =
      await this.requireGroupManager(
        conversationId,
        userId,
      );

    if (
      !['president', 'vice_president'].includes(
        actor.role,
      )
    ) {
      throw new BadRequestException(
        'Only the president or vice president can edit group details.',
      );
    }

    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new BadRequestException(
          'Group name cannot be empty.',
        );
      }
      updateData.name = trimmedName;
    }

    if (avatarUrl !== undefined) {
      updateData.avatar_url =
        avatarUrl.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'Provide a group name or avatar URL to update.',
      );
    }

    updateData.updated_at =
      new Date().toISOString();

    const { data, error } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select(
        'id, type, name, avatar_url, created_by, created_at, updated_at',
      )
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Group updated successfully.',
      conversation: {
        id: data.id,
        type: data.type,
        name: data.name,
        avatarUrl: data.avatar_url,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  }

  async getMessages(
    userId: string,
    conversationId: string,
    pagination: PaginationDto,
  ) {
    // make sure the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: messages,
      error,
      count: total,
    } = await supabase
      .from('messages')
      .select(
        `
        id,
        sender_id,
        content,
        created_at,
        is_read,
        delivered_at,
        seen_at,
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
        ),

        message_reactions (
          id,
          user_id,
          reaction,
          created_at
        )
      `,
        {
          count: 'exact',
        },
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .order('created_at', {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const { data: conversation, error: conversationError } =
      await supabase
        .from('conversations')
        .select(
          'id, type, name, avatar_url, created_by, created_at, updated_at',
        )
        .eq('id', conversationId)
        .maybeSingle();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    if (!conversation) {
      throw new BadRequestException(
        'Conversation not found.',
      );
    }

    let groupMembers: any[] = [];
    let groupMemberCount = 0;

    if (conversation.type === 'group') {
      const {
        data: members,
        error: groupMembersError,
        count,
      } = await supabase
        .from('conversation_members')
        .select(
          `
          user_id,
          role,
          joined_at,
          users (
            id,
            display_name,
            username,
            avatar_url,
            is_online,
            last_seen
          )
        `,
          { count: 'exact' },
        )
        .eq('conversation_id', conversationId)
        .order('joined_at', { ascending: true });

      if (groupMembersError) {
        throw new BadRequestException(
          groupMembersError.message,
        );
      }

      groupMemberCount = count ?? 0;
      groupMembers = (members ?? [])
        .map((member: any) => {
          const memberUser = member.users;
          if (!memberUser) return null;
          return {
            id: memberUser.id,
            username: memberUser.username,
            displayName: memberUser.display_name,
            avatarUrl: memberUser.avatar_url,
            isOnline: memberUser.is_online,
            lastSeen: memberUser.last_seen,
            role: member.role ?? 'member',
            joinedAt: member.joined_at,
          };
        })
        .filter(Boolean);
    }

    // get the other participant
    const {
      data: otherMember,
      error: memberError,
    } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq(
        'conversation_id',
        conversationId,
      )
      .neq('user_id', userId)
      .limit(1)
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
        .select(
          `
          id,
          display_name,
          username,
          avatar_url,
          is_online,
          last_seen
        `,
        )
        .eq(
          'id',
          otherMember.user_id,
        )
        .single();

      if (userError) {
        throw new BadRequestException(
          userError.message,
        );
      }

      user = otherUser;
    }

    const senderIds = [
      ...new Set(
        (messages ?? []).map(
          (message: any) => message.sender_id,
        ),
      ),
    ];

    const senderMap = new Map<string, any>();

    if (senderIds.length > 0) {
      const { data: senders, error: sendersError } =
        await supabase
          .from('users')
          .select(`
            id,
            display_name,
            username,
            avatar_url,
            is_online,
            last_seen
          `)
          .in('id', senderIds);

      if (sendersError) {
        throw new BadRequestException(
          sendersError.message,
        );
      }

      for (const sender of senders ?? []) {
        senderMap.set(sender.id, {
          id: sender.id,
          username: sender.username,
          displayName: sender.display_name,
          avatarUrl: sender.avatar_url,
          isOnline: sender.is_online,
          lastSeen: sender.last_seen,
        });
      }
    }

    // create signed URLs and format each message
    const formattedMessages =
      await Promise.all(
        (messages ?? []).map(
          async (message) => {
            const media =
              await Promise.all(
                (
                  message.message_media ??
                  []
                ).map(
                  async (
                    attachment: any,
                  ) => {
                    const mediaFile =
                      attachment.media_files;

                    if (!mediaFile) {
                      return {
                        mediaId:
                          attachment.media_id,
                        url: null,
                      };
                    }

                    const {
                      data:
                        signedUrlData,
                      error:
                        signedUrlError,
                    } =
                      await supabase.storage
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
                      mediaId:
                        attachment.media_id,
                      id: mediaFile.id,
                      originalName:
                        mediaFile.original_name,
                      mimeType:
                        mediaFile.mime_type,
                      sizeBytes:
                        mediaFile.size_bytes,
                      url:
                        signedUrlData
                          ?.signedUrl ??
                        null,
                      expiresIn: 3600,
                    };
                  },
                ),
              );

            const reactions =
              message.message_reactions ??
              [];

            const reactionCounts:
              Record<string, number> = {};

            for (
              const reaction of reactions
            ) {
              reactionCounts[
                reaction.reaction
              ] =
                (
                  reactionCounts[
                    reaction.reaction
                  ] ?? 0
                ) + 1;
            }

            const formattedReactions =
              Object.entries(
                reactionCounts,
              ).map(
                ([reaction, count]) => ({
                  reaction,
                  count,
                  reactedByMe:
                    reactions.some(
                      (item: any) =>
                        item.user_id ===
                          userId &&
                        item.reaction ===
                          reaction,
                    ),
                }),
              );

            const {
              data: mentions,
              error: mentionsError,
            } = await supabase
              .from('message_mentions')
              .select(`
                user_id,
                username,
                display_name
              `)
              .eq(
                'message_id',
                message.id,
              );

            if (mentionsError) {
              throw new BadRequestException(
                mentionsError.message,
              );
            }

            return {
              id: message.id,
              senderId:
                message.sender_id,
              sender:
                senderMap.get(message.sender_id) ?? null,
              content:
                message.content,
              createdAt:
                message.created_at,
              isRead:
                message.is_read,
              deliveredAt:
                message.delivered_at,
              seenAt:
                message.seen_at,
              replyToMessageId:
                message.reply_to_message_id,
              mentions:
                (mentions ?? []).map(
                  (mention: any) => ({
                    userId:
                      mention.user_id,
                    username:
                      mention.username,
                    displayName:
                      mention.display_name,
                  }),
                ),
              media,
              reactions:
                formattedReactions,
            };
          },
        ),
      );

    const totalCount = total ?? 0;

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount / limit,
          )
        : 0;

    return {
      success: true,

      user,
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name ?? null,
        avatarUrl: conversation.avatar_url ?? null,
        createdBy: conversation.created_by ?? null,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        memberCount:
          conversation.type === 'group'
            ? groupMemberCount
            : 2,
        members:
          conversation.type === 'group'
            ? groupMembers
            : [],
      },

      messages: formattedMessages,

      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
    file?: any,
  ) {
    // make sure the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // validate mentions for group conversations
    if (
      dto.mentions &&
      dto.mentions.length > 0
    ) {
      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select('id, type')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversationError) {
        throw new BadRequestException(
          conversationError.message,
        );
      }

      if (!conversation) {
        throw new BadRequestException(
          'Conversation not found.',
        );
      }

      if (conversation.type !== 'group') {
        throw new BadRequestException(
          'Mentions are only supported in group conversations.',
        );
      }

      const mentionedUserIds = [
        ...new Set(
          dto.mentions.map(
            (mention) => mention.userId,
          ),
        ),
      ];

      const {
        data: mentionedMembers,
        error: mentionedMembersError,
      } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq(
          'conversation_id',
          conversationId,
        )
        .in(
          'user_id',
          mentionedUserIds,
        );

      if (mentionedMembersError) {
        throw new BadRequestException(
          mentionedMembersError.message,
        );
      }

      if (
        !mentionedMembers ||
        mentionedMembers.length !==
          mentionedUserIds.length
      ) {
        throw new BadRequestException(
          'One or more mentioned users are not members of this group.',
        );
      }
    }

    // create the message
    const {
      data: message,
      error: messageError,
    } = await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversationId,
        sender_id: userId,
        content: dto.content ?? '',
        reply_to_message_id:
          dto.replyToMessageId ?? null,
      })
      .select()
      .single();

    if (messageError) {
      throw new BadRequestException(
        messageError.message,
      );
    }

    // save mentions attached to the message
    if (
      dto.mentions &&
      dto.mentions.length > 0
    ) {
      const mentionRecords =
        dto.mentions.map(
          (mention) => ({
            message_id: message.id,
            user_id: mention.userId,
            username: mention.username,
            display_name:
              mention.displayName ?? null,
          }),
        );

      const {
        error: mentionsError,
      } = await supabase
        .from('message_mentions')
        .insert(mentionRecords);

      if (mentionsError) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', message.id);

        throw new BadRequestException(
          mentionsError.message,
        );
      }
    }

    let uploadedMediaId:
      | string
      | null = null;

    if (file) {
      try {
        const uploadResult =
          await this.mediaService.upload(
            userId,
            file,
          );

        uploadedMediaId =
          uploadResult?.data?.id ?? null;

        if (!uploadedMediaId) {
          throw new BadRequestException(
            'Media uploaded but media ID was not returned.',
          );
        }

        // attach the uploaded media to the message
        const {
          error: attachmentError,
        } = await supabase
          .from('message_media')
          .insert({
            message_id: message.id,
            media_id:
              uploadedMediaId,
          });

        if (attachmentError) {
          // clean up the uploaded file if attachment fails
          const {
            data: mediaFile,
          } = await supabase
            .from('media_files')
            .select(
              'storage_path',
            )
            .eq(
              'id',
              uploadedMediaId,
            )
            .maybeSingle();

          if (mediaFile) {
            await supabase.storage
              .from('media')
              .remove([
                mediaFile.storage_path,
              ]);
          }

          // remove the media record as well
          await supabase
            .from('media_files')
            .delete()
            .eq(
              'id',
              uploadedMediaId,
            );

          throw new BadRequestException(
            attachmentError.message,
          );
        }
      } catch (error) {
        // remove the message if media upload fails
        await supabase
          .from('messages')
          .delete()
          .eq(
            'id',
            message.id,
          );

        if (
          error instanceof
          BadRequestException
        ) {
          throw error;
        }

        throw new BadRequestException(
          'Failed to upload message media.',
        );
      }
    }

    // attach media IDs that were already uploaded
    if (
      dto.mediaIds &&
      dto.mediaIds.length > 0
    ) {
      const attachments =
        dto.mediaIds.map(
          (mediaId) => ({
            message_id:
              message.id,
            media_id: mediaId,
          }),
        );

      const {
        error: attachmentError,
      } = await supabase
        .from('message_media')
        .insert(attachments);

      if (attachmentError) {
        await supabase
          .from('messages')
          .delete()
          .eq(
            'id',
            message.id,
          );

        throw new BadRequestException(
          attachmentError.message,
        );
      }
    }

    // get all media attached to the message
    const {
      data: media,
      error: mediaError,
    } = await supabase
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
      .eq(
        'message_id',
        message.id,
      );

    if (mediaError) {
      throw new BadRequestException(
        mediaError.message,
      );
    }

    return {
      success: true,
      message:
        'Message sent successfully.',
      data: {
        ...message,
        mentions: dto.mentions ?? [],
        media: media ?? [],
      },
    };
  }

  async markMessagesAsRead(
    userId: string,
    conversationId: string,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    const { error } =
      await supabase
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
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // mark the message as delivered
    const {
      data,
      error,
    } = await supabase
      .from('messages')
      .update({
        delivered_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .neq(
        'sender_id',
        userId,
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Message marked as delivered.',
      data,
    };
  }

  async markMessageAsSeen(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // mark the message as seen
    const {
      data,
      error,
    } = await supabase
      .from('messages')
      .update({
        delivered_at:
          new Date().toISOString(),
        seen_at:
          new Date().toISOString(),
        is_read: true,
      })
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .neq(
        'sender_id',
        userId,
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Message marked as seen.',
      data,
    };
  }

  async updateMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // get the conversation type
    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from('conversations')
      .select('id, type')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError) {
      throw new BadRequestException(
        conversationError.message,
      );
    }

    if (!conversation) {
      throw new BadRequestException(
        'Conversation not found.',
      );
    }

    // validate mentions for group conversations
    if (
      dto.mentions &&
      dto.mentions.length > 0
    ) {
      if (conversation.type !== 'group') {
        throw new BadRequestException(
          'Mentions are only supported in group conversations.',
        );
      }

      const mentionedUserIds = [
        ...new Set(
          dto.mentions.map(
            (mention) => mention.userId,
          ),
        ),
      ];

      const {
        data: mentionedMembers,
        error: mentionedMembersError,
      } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq(
          'conversation_id',
          conversationId,
        )
        .in(
          'user_id',
          mentionedUserIds,
        );

      if (mentionedMembersError) {
        throw new BadRequestException(
          mentionedMembersError.message,
        );
      }

      if (
        !mentionedMembers ||
        mentionedMembers.length !==
          mentionedUserIds.length
      ) {
        throw new BadRequestException(
          'One or more mentioned users are not members of this group.',
        );
      }
    }

    // update only the current user's message
    const {
      data,
      error,
    } = await supabase
      .from('messages')
      .update({
        content: dto.content,
      })
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .eq(
        'sender_id',
        userId,
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // remove old mentions
    const {
      error: deleteMentionsError,
    } = await supabase
      .from('message_mentions')
      .delete()
      .eq(
        'message_id',
        messageId,
      );

    if (deleteMentionsError) {
      throw new BadRequestException(
        deleteMentionsError.message,
      );
    }

    // save the new mentions
    if (
      dto.mentions &&
      dto.mentions.length > 0
    ) {
      const mentionRecords =
        dto.mentions.map(
          (mention) => ({
            message_id: messageId,
            user_id: mention.userId,
            username: mention.username,
            display_name:
              mention.displayName ?? null,
          }),
        );

      const {
        error: mentionsError,
      } = await supabase
        .from('message_mentions')
        .insert(mentionRecords);

      if (mentionsError) {
        throw new BadRequestException(
          mentionsError.message,
        );
      }
    }

    return {
      success: true,
      message:
        'Message updated successfully.',
      data: {
        ...data,
        mentions: dto.mentions ?? [],
      },
    };
  }

  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // get attached media before deleting the message
    const {
      data: attachments,
      error: attachmentError,
    } = await supabase
      .from('message_media')
      .select(`
        media_id,
        media_files (
          id,
          storage_path
        )
      `)
      .eq(
        'message_id',
        messageId,
      );

    if (attachmentError) {
      throw new BadRequestException(
        attachmentError.message,
      );
    }

    // delete only the current user's message
    const {
      data,
      error,
    } = await supabase
      .from('messages')
      .delete()
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .eq(
        'sender_id',
        userId,
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // clean up media that is no longer used
    for (
      const attachment of
        attachments ?? []
    ) {
      const mediaId =
        attachment.media_id;

      const mediaFile =
        attachment.media_files as any;

      if (!mediaFile) {
        continue;
      }

      const {
        count: referenceCount,
        error: referenceError,
      } = await supabase
        .from('message_media')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'media_id',
          mediaId,
        );

      if (referenceError) {
        throw new BadRequestException(
          referenceError.message,
        );
      }

      if (
        (referenceCount ?? 0) > 0
      ) {
        continue;
      }

      // remove the file from storage
      const {
        error: storageError,
      } =
        await supabase.storage
          .from('media')
          .remove([
            mediaFile.storage_path,
          ]);

      if (storageError) {
        throw new BadRequestException(
          storageError.message,
        );
      }

      // remove the media record
      const {
        error: mediaDeleteError,
      } = await supabase
        .from('media_files')
        .delete()
        .eq(
          'id',
          mediaId,
        );

      if (mediaDeleteError) {
        throw new BadRequestException(
          mediaDeleteError.message,
        );
      }
    }

    return {
      success: true,
      message:
        'Message deleted successfully.',
      data,
    };
  }

  async forwardMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    dto: ForwardMessageDto,
  ) {
    // check membership in the source conversation
    const {
      data: sourceMembership,
      error: sourceMembershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // get the original message
    const {
      data: originalMessage,
      error: messageError,
    } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        message_media (
          media_id
        )
      `)
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // check membership in the target conversation
    const {
      data: targetMembership,
      error: targetMembershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        dto.targetConversationId,
      )
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

    // create the forwarded message
    const {
      data: forwardedMessage,
      error: insertError,
    } = await supabase
      .from('messages')
      .insert({
        conversation_id:
          dto.targetConversationId,
        sender_id: userId,
        content:
          originalMessage.content ??
          '',
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(
        insertError.message,
      );
    }

    const mediaAttachments =
      originalMessage.message_media ??
      [];

    if (
      mediaAttachments.length > 0
    ) {
      const attachments =
        mediaAttachments.map(
          (attachment: any) => ({
            message_id:
              forwardedMessage.id,
            media_id:
              attachment.media_id,
          }),
        );

      const {
        error: mediaError,
      } = await supabase
        .from('message_media')
        .insert(attachments);

      if (mediaError) {
        await supabase
          .from('messages')
          .delete()
          .eq(
            'id',
            forwardedMessage.id,
          );

        throw new BadRequestException(
          mediaError.message,
        );
      }
    }

    // get the media attached to the forwarded message
    const {
      data: media,
      error: mediaFetchError,
    } = await supabase
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
      .eq(
        'message_id',
        forwardedMessage.id,
      );

    if (mediaFetchError) {
      throw new BadRequestException(
        mediaFetchError.message,
      );
    }

    return {
      success: true,
      message:
        'Message forwarded successfully.',
      data: {
        ...forwardedMessage,
        media: media ?? [],
      },
    };
  }

  async addReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // make sure the message exists
    const {
      data: message,
      error: messageError,
    } = await supabase
      .from('messages')
      .select('id')
      .eq(
        'id',
        messageId,
      )
      .eq(
        'conversation_id',
        conversationId,
      )
      .maybeSingle();

    if (messageError) {
      throw new BadRequestException(
        messageError.message,
      );
    }

    if (!message) {
      throw new BadRequestException(
        'Message not found.',
      );
    }

    // add or update the user's reaction
    const {
      data,
      error,
    } = await supabase
      .from('message_reactions')
      .upsert(
        {
          message_id:
            messageId,
          user_id: userId,
          reaction,
        },
        {
          onConflict:
            'message_id,user_id',
        },
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Reaction added successfully.',
      data,
    };
  }

  async removeReaction(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    // check that the user belongs to the conversation
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq(
        'conversation_id',
        conversationId,
      )
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

    // remove the user's reaction
    const {
      data,
      error,
    } = await supabase
      .from('message_reactions')
      .delete()
      .eq(
        'message_id',
        messageId,
      )
      .eq(
        'user_id',
        userId,
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: data
        ? 'Reaction removed successfully.'
        : 'No reaction found.',
      data,
    };
  }
}