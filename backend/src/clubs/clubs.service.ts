import {
  BadRequestException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClubsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // higher number means higher authority
  private readonly roleLevel: Record<string, number> = {
    president: 5,
    vice_president: 4,
    moderator: 3,
    volunteer: 2,
    member: 1,
  };

  private readonly allowedRoles = [
    'president',
    'vice_president',
    'moderator',
    'volunteer',
    'member',
  ];

  async createClub(
    userId: string,
    dto: CreateClubDto,
  ) {
    const {
      data: club,
      error: clubError,
    } = await supabase
      .from('clubs')
      .insert({
        name: dto.name,
        category: dto.category,
        description: dto.description,
        cover_image_url:
          dto.coverImageUrl ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (clubError) {
      throw new BadRequestException(
        clubError.message,
      );
    }

    // add the creator as president
    const {
      error: memberError,
    } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: userId,
        role: 'president',
      });

    if (memberError) {
      // remove the club if the membership could not be created
      await supabase
        .from('clubs')
        .delete()
        .eq('id', club.id);

      throw new BadRequestException(
        memberError.message,
      );
    }

    return {
      success: true,
      message:
        'Club created successfully.',
      club: {
        id: club.id,
        name: club.name,
        category: club.category,
        description: club.description,
        coverImageUrl:
          club.cover_image_url,
        createdBy:
          club.created_by,
        createdAt:
          club.created_at,
        updatedAt:
          club.updated_at,
      },
    };
  }

  async findAll(
    userId: string,
    pagination: PaginationDto,
  ) {
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: clubs,
      error: clubsError,
      count,
    } = await supabase
      .from('clubs')
      .select('*', {
        count: 'exact',
      })
      .order('created_at', {
        ascending: false,
      })
      .range(from, to);

    if (clubsError) {
      throw new BadRequestException(
        clubsError.message,
      );
    }

    const clubsWithDetails =
      await Promise.all(
        (clubs ?? []).map(
          async (club) => {
            const {
              count: memberCount,
              error: countError,
            } = await supabase
              .from('club_members')
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'club_id',
                club.id,
              );

            if (countError) {
              throw new BadRequestException(
                countError.message,
              );
            }

            const {
              data: membership,
              error:
                membershipError,
            } = await supabase
              .from('club_members')
              .select(
                'id, role',
              )
              .eq(
                'club_id',
                club.id,
              )
              .eq(
                'user_id',
                userId,
              )
              .maybeSingle();

            if (membershipError) {
              throw new BadRequestException(
                membershipError.message,
              );
            }

            return {
              id: club.id,
              name: club.name,
              category:
                club.category,
              description:
                club.description,
              coverImageUrl:
                club.cover_image_url,
              memberCount:
                memberCount ?? 0,
              isJoined:
                !!membership,
              role:
                membership?.role ??
                null,
              createdBy:
                club.created_by,
              createdAt:
                club.created_at,
              updatedAt:
                club.updated_at,
            };
          },
        ),
      );

    const total = count ?? 0;

    const totalPages =
      Math.ceil(
        total / limit,
      );

    return {
      success: true,
      clubs:
        clubsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },
    };
  }

  async joinClub(
    userId: string,
    clubId: string,
  ) {
    // check if the club exists
    const {
      data: club,
      error: clubError,
    } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('id', clubId)
      .maybeSingle();

    if (clubError) {
      throw new BadRequestException(
        clubError.message,
      );
    }

    if (!club) {
      throw new BadRequestException(
        'Club not found.',
      );
    }

    // check if the user is already a member
    const {
      data: existingMember,
      error: memberError,
    } = await supabase
      .from('club_members')
      .select('id, role')
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (memberError) {
      throw new BadRequestException(
        memberError.message,
      );
    }

    if (existingMember) {
      return {
        success: true,
        message:
          'You have already joined this club.',
        role:
          existingMember.role,
      };
    }

    // new members always start with the member role
    const {
      error: joinError,
    } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: userId,
        role: 'member',
      });

    if (joinError) {
      throw new BadRequestException(
        joinError.message,
      );
    }

    // notify the club president about the new member
    const {
      data: presidents,
      error: presidentsError,
    } = await supabase
      .from('club_members')
      .select('user_id')
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'role',
        'president',
      );

    if (
      !presidentsError &&
      presidents
    ) {
      await Promise.all(
        presidents.map(
          (president) =>
            this.notificationsService
              .tryCreateNotification(
                president.user_id,
                'CLUB_JOIN',
                'New club member',
                'Someone joined your club.',
                userId,
                clubId,
                'CLUB',
              ),
        ),
      );
    } else if (
      presidentsError
    ) {
      console.error(
        'Unable to find club presidents for notification:',
        presidentsError.message,
      );
    }

    return {
      success: true,
      message:
        'Joined club successfully.',
      role: 'member',
    };
  }

  async leaveClub(
    userId: string,
    clubId: string,
  ) {
    const {
      data: membership,
      error: memberError,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (memberError) {
      throw new BadRequestException(
        memberError.message,
      );
    }

    if (!membership) {
      throw new BadRequestException(
        'You have not joined this club.',
      );
    }

    // the only president cannot leave the club
    if (
      membership.role ===
      'president'
    ) {
      const {
        count: presidentCount,
        error: presidentError,
      } = await supabase
        .from('club_members')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq(
          'club_id',
          clubId,
        )
        .eq(
          'role',
          'president',
        );

      if (presidentError) {
        throw new BadRequestException(
          presidentError.message,
        );
      }

      if (
        (presidentCount ?? 0) <= 1
      ) {
        throw new BadRequestException(
          'You are the only president. Transfer the presidency before leaving the club.',
        );
      }
    }

    const {
      error: deleteError,
    } = await supabase
      .from('club_members')
      .delete()
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      );

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    return {
      success: true,
      message:
        'Left club successfully.',
    };
  }

  async getSuggested(
    userId: string,
  ) {
    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select('interest')
      .eq('id', userId)
      .single();

    if (
      userError ||
      !user
    ) {
      throw new BadRequestException(
        'User not found.',
      );
    }

    const interests =
      Array.isArray(
        user.interest,
      )
        ? user.interest
        : [];

    const {
      data: clubs,
      error: clubsError,
    } = await supabase
      .from('clubs')
      .select('*')
      .order(
        'created_at',
        {
          ascending: false,
        },
      );

    if (clubsError) {
      throw new BadRequestException(
        clubsError.message,
      );
    }

    const suggestedClubs =
      (clubs ?? []).filter(
        (club) =>
          interests.some(
            (
              interest: string,
            ) =>
              interest
                .trim()
                .toLowerCase() ===
              club.category
                .trim()
                .toLowerCase(),
          ),
      );

    const clubsWithDetails =
      await Promise.all(
        suggestedClubs.map(
          async (club) => {
            const {
              count: memberCount,
              error: countError,
            } = await supabase
              .from(
                'club_members',
              )
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'club_id',
                club.id,
              );

            if (countError) {
              throw new BadRequestException(
                countError.message,
              );
            }

            const {
              data: membership,
              error:
                membershipError,
            } = await supabase
              .from('club_members')
              .select(
                'id, role',
              )
              .eq(
                'club_id',
                club.id,
              )
              .eq(
                'user_id',
                userId,
              )
              .maybeSingle();

            if (
              membershipError
            ) {
              throw new BadRequestException(
                membershipError.message,
              );
            }

            return {
              id: club.id,
              name: club.name,
              category:
                club.category,
              description:
                club.description,
              coverImageUrl:
                club.cover_image_url,
              memberCount:
                memberCount ?? 0,
              isJoined:
                !!membership,
              role:
                membership?.role ??
                null,
              createdBy:
                club.created_by,
              createdAt:
                club.created_at,
              updatedAt:
                club.updated_at,
            };
          },
        ),
      );

    return {
      success: true,
      clubs:
        clubsWithDetails,
    };
  }

  async getMyClubs(
    userId: string,
  ) {
    const {
      data: memberships,
      error:
        membershipError,
    } = await supabase
      .from('club_members')
      .select(`
        id,
        joined_at,
        role,
        clubs (
          id,
          name,
          category,
          description,
          cover_image_url,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq(
        'user_id',
        userId,
      )
      .order(
        'joined_at',
        {
          ascending: false,
        },
      );

    if (membershipError) {
      throw new BadRequestException(
        membershipError.message,
      );
    }

    const clubs =
      await Promise.all(
        (memberships ?? []).map(
          async (
            membership: any,
          ) => {
            const club =
              membership.clubs;

            if (!club) {
              return null;
            }

            const {
              count: memberCount,
              error: countError,
            } = await supabase
              .from(
                'club_members',
              )
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'club_id',
                club.id,
              );

            if (countError) {
              throw new BadRequestException(
                countError.message,
              );
            }

            return {
              id: club.id,
              name: club.name,
              category:
                club.category,
              description:
                club.description,
              coverImageUrl:
                club.cover_image_url,
              memberCount:
                memberCount ?? 0,
              isJoined: true,
              role:
                membership.role,
              joinedAt:
                membership.joined_at,
              createdBy:
                club.created_by,
              createdAt:
                club.created_at,
              updatedAt:
                club.updated_at,
            };
          },
        ),
      );

    return {
      success: true,
      clubs:
        clubs.filter(Boolean),
    };
  }

  async getOne(
    userId: string,
    clubId: string,
  ) {
    const {
      data: club,
      error: clubError,
    } = await supabase
      .from('clubs')
      .select('*')
      .eq(
        'id',
        clubId,
      )
      .maybeSingle();

    if (clubError) {
      throw new BadRequestException(
        clubError.message,
      );
    }

    if (!club) {
      throw new BadRequestException(
        'Club not found.',
      );
    }

    const {
      count: memberCount,
      error: countError,
    } = await supabase
      .from('club_members')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq(
        'club_id',
        clubId,
      );

    if (countError) {
      throw new BadRequestException(
        countError.message,
      );
    }

    const {
      data: membership,
      error:
        membershipError,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (membershipError) {
      throw new BadRequestException(
        membershipError.message,
      );
    }

    return {
      success: true,
      club: {
        id: club.id,
        name: club.name,
        category:
          club.category,
        description:
          club.description,
        coverImageUrl:
          club.cover_image_url,
        memberCount:
          memberCount ?? 0,
        isJoined:
          !!membership,
        role:
          membership?.role ??
          null,
        createdBy:
          club.created_by,
        createdAt:
          club.created_at,
        updatedAt:
          club.updated_at,
      },
    };
  }

  async getMembers(
    clubId: string,
  ) {
    // check that the club exists
    const {
      data: club,
      error: clubError,
    } = await supabase
      .from('clubs')
      .select('id')
      .eq(
        'id',
        clubId,
      )
      .maybeSingle();

    if (clubError) {
      throw new BadRequestException(
        clubError.message,
      );
    }

    if (!club) {
      throw new BadRequestException(
        'Club not found.',
      );
    }

    // get the members
    const {
      data: members,
      error: membersError,
    } = await supabase
      .from('club_members')
      .select(`
        id,
        joined_at,
        user_id,
        role,
        users (
          id,
          username,
          display_name,
          bio,
          avatar_url,
          city
        )
      `)
      .eq(
        'club_id',
        clubId,
      )
      .order(
        'joined_at',
        {
          ascending: true,
        },
      );

    if (membersError) {
      throw new BadRequestException(
        membersError.message,
      );
    }

    const safeMembers =
      (members ?? []).map(
        (member: any) => ({
          id:
            member.users?.id,
          username:
            member.users?.username,
          displayName:
            member.users?.display_name,
          bio:
            member.users?.bio,
          avatarUrl:
            member.users?.avatar_url,
          city:
            member.users?.city,
          role:
            member.role,
          joinedAt:
            member.joined_at,
        }),
      );

    return {
      success: true,
      memberCount:
        safeMembers.length,
      members:
        safeMembers,
    };
  }

  async updateClub(
    userId: string,
    clubId: string,
    dto: UpdateClubDto,
  ) {
    await this.requirePresident(
      userId,
      clubId,
    );

    const updateData: any = {};

    if (
      dto.name !== undefined
    ) {
      updateData.name =
        dto.name;
    }

    if (
      dto.category !== undefined
    ) {
      updateData.category =
        dto.category;
    }

    if (
      dto.description !==
      undefined
    ) {
      updateData.description =
        dto.description;
    }

    if (
      dto.coverImageUrl !==
      undefined
    ) {
      updateData.cover_image_url =
        dto.coverImageUrl;
    }

    if (
      Object.keys(updateData)
        .length === 0
    ) {
      throw new BadRequestException(
        'No club fields provided for update.',
      );
    }

    const {
      data: club,
      error: updateError,
    } = await supabase
      .from('clubs')
      .update(
        updateData,
      )
      .eq(
        'id',
        clubId,
      )
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    return {
      success: true,
      message:
        'Club updated successfully.',
      club: {
        id: club.id,
        name: club.name,
        category:
          club.category,
        description:
          club.description,
        coverImageUrl:
          club.cover_image_url,
        createdBy:
          club.created_by,
        createdAt:
          club.created_at,
        updatedAt:
          club.updated_at,
      },
    };
  }

  async deleteClub(
    userId: string,
    clubId: string,
  ) {
    await this.requirePresident(
      userId,
      clubId,
    );

    // remove memberships before deleting the club
    const {
      error: membersError,
    } = await supabase
      .from('club_members')
      .delete()
      .eq(
        'club_id',
        clubId,
      );

    if (membersError) {
      throw new BadRequestException(
        membersError.message,
      );
    }

    // delete the club
    const {
      error: deleteError,
    } = await supabase
      .from('clubs')
      .delete()
      .eq(
        'id',
        clubId,
      );

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    return {
      success: true,
      message:
        'Club deleted successfully.',
    };
  }

  async removeMember(
    userId: string,
    clubId: string,
    targetUserId: string,
  ) {
    const actorRole =
      await this.requireMemberManagementPermission(
        userId,
        clubId,
      );

    const {
      data: targetMember,
      error: targetError,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        targetUserId,
      )
      .maybeSingle();

    if (targetError) {
      throw new BadRequestException(
        targetError.message,
      );
    }

    if (!targetMember) {
      throw new BadRequestException(
        'User is not a member of this club.',
      );
    }

    // president cannot be removed
    if (
      targetMember.role ===
      'president'
    ) {
      throw new ForbiddenException(
        'The president cannot be removed from the club.',
      );
    }

    const actorLevel =
      this.roleLevel[
        actorRole
      ];

    const targetLevel =
      this.roleLevel[
        targetMember.role
      ];

    // only a higher role can remove the target
    if (
      actorLevel <=
      targetLevel
    ) {
      throw new ForbiddenException(
        'You can only remove members with a lower role than yours.',
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from('club_members')
      .delete()
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        targetUserId,
      );

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    await this.notificationsService
      .tryCreateNotification(
        targetUserId,
        'CLUB_REMOVED',
        'Removed from club',
        'You were removed from a club.',
        userId,
        clubId,
        'CLUB',
      );

    return {
      success: true,
      message:
        'Member removed successfully.',
    };
  }

  async updateMemberRole(
    userId: string,
    clubId: string,
    targetUserId: string,
    role: string,
  ) {
    const actorRole =
      await this.requireRoleManagementPermission(
        userId,
        clubId,
      );

    // make sure the new role is valid
    if (
      !this.allowedRoles.includes(
        role,
      )
    ) {
      throw new BadRequestException(
        'Invalid role. Allowed roles: president, vice_president, moderator, volunteer, member.',
      );
    }

    const {
      data: targetMember,
      error: targetError,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        targetUserId,
      )
      .maybeSingle();

    if (targetError) {
      throw new BadRequestException(
        targetError.message,
      );
    }

    if (!targetMember) {
      throw new BadRequestException(
        'User is not a member of this club.',
      );
    }

    const actorLevel =
      this.roleLevel[
        actorRole
      ];

    const targetCurrentLevel =
      this.roleLevel[
        targetMember.role
      ];

    const newRoleLevel =
      this.roleLevel[
        role
      ];

    if (
      role === 'president'
    ) {
      if (
        actorRole !==
        'president'
      ) {
        throw new ForbiddenException(
          'Only the current president can appoint a new president.',
        );
      }

      if (
        targetUserId ===
        userId
      ) {
        return {
          success: true,
          message:
            'You are already the president.',
          member: {
            id:
              targetMember.id,
            userId:
              targetUserId,
            role:
              targetMember.role,
          },
        };
      }

      // promote the new president first
      const {
        error: promoteError,
      } = await supabase
        .from('club_members')
        .update({
          role: 'president',
        })
        .eq(
          'club_id',
          clubId,
        )
        .eq(
          'user_id',
          targetUserId,
        );

      if (promoteError) {
        throw new BadRequestException(
          promoteError.message,
        );
      }

      const {
        error: demoteError,
      } = await supabase
        .from('club_members')
        .update({
          role: 'vice_president',
        })
        .eq(
          'club_id',
          clubId,
        )
        .eq(
          'user_id',
          userId,
        );

      if (demoteError) {
        // try to put the target back to their old role
        await supabase
          .from('club_members')
          .update({
            role:
              targetMember.role,
          })
          .eq(
            'club_id',
            clubId,
          )
          .eq(
            'user_id',
            targetUserId,
          );

        throw new BadRequestException(
          demoteError.message,
        );
      }

      await this.notificationsService
        .tryCreateNotification(
          targetUserId,
          'CLUB_ROLE_CHANGED',
          'You are now the club president',
          'You have been appointed as the president of the club.',
          userId,
          clubId,
          'CLUB',
        );

      await this.notificationsService
        .tryCreateNotification(
          userId,
          'CLUB_ROLE_CHANGED',
          'Club role changed',
          'You are now the vice president of the club.',
          targetUserId,
          clubId,
          'CLUB',
        );

      return {
        success: true,
        message:
          'Presidency transferred successfully.',
        member: {
          id:
            targetMember.id,
          userId:
            targetUserId,
          role:
            'president',
        },
      };
    }

    // the president can only transfer the presidency
    if (
      targetMember.role ===
      'president'
    ) {
      throw new ForbiddenException(
        'The president can only transfer the presidency themselves.',
      );
    }

    // actor must have a higher role than the target
    if (
      actorLevel <=
      targetCurrentLevel
    ) {
      throw new ForbiddenException(
        'You can only manage members with a lower role than yours.',
      );
    }

    // don't allow assigning an equal or higher role
    if (
      newRoleLevel >=
      actorLevel
    ) {
      throw new ForbiddenException(
        'You cannot assign a role equal to or higher than your own role.',
      );
    }

    const {
      data: updatedMember,
      error: updateError,
    } = await supabase
      .from('club_members')
      .update({
        role,
      })
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        targetUserId,
      )
      .select(
        'id, user_id, role, joined_at',
      )
      .single();

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    await this.notificationsService
      .tryCreateNotification(
        targetUserId,
        'CLUB_ROLE_CHANGED',
        'Club role changed',
        `Your club role was changed to ${role}.`,
        userId,
        clubId,
        'CLUB',
      );

    return {
      success: true,
      message:
        'Member role updated successfully.',
      member: {
        id:
          updatedMember.id,
        userId:
          updatedMember.user_id,
        role:
          updatedMember.role,
        joinedAt:
          updatedMember.joined_at,
      },
    };
  }

  private async requirePresident(
    userId: string,
    clubId: string,
  ) {
    const {
      data: membership,
      error,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this club.',
      );
    }

    if (
      membership.role !==
      'president'
    ) {
      throw new ForbiddenException(
        'Only the club president can perform this action.',
      );
    }

    return membership.role;
  }

  private async requireMemberManagementPermission(
    userId: string,
    clubId: string,
  ) {
    const {
      data: membership,
      error,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this club.',
      );
    }

    const allowedManagerRoles = [
      'president',
      'vice_president',
      'moderator',
    ];

    if (
      !allowedManagerRoles.includes(
        membership.role,
      )
    ) {
      throw new ForbiddenException(
        'Only the president, vice president, or moderator can manage club members.',
      );
    }

    return membership.role;
  }

  private async requireRoleManagementPermission(
    userId: string,
    clubId: string,
  ) {
    const {
      data: membership,
      error,
    } = await supabase
      .from('club_members')
      .select(
        'id, role',
      )
      .eq(
        'club_id',
        clubId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this club.',
      );
    }

    const allowedManagerRoles = [
      'president',
      'vice_president',
      'moderator',
    ];

    if (
      !allowedManagerRoles.includes(
        membership.role,
      )
    ) {
      throw new ForbiddenException(
        'Only the president, vice president, or moderator can change member roles.',
      );
    }

    return membership.role;
  }
}