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

  // =========================================================
  // ROLE HIERARCHY
  // =========================================================
  //
  // Higher number = higher authority
  //
  // president       = 5
  // vice_president  = 4
  // moderator       = 3
  // volunteer       = 2
  // member          = 1
  //
  // =========================================================

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

  // =========================================================
  // CREATE CLUB
  // =========================================================

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

    // =======================================================
    // CREATOR BECOMES PRESIDENT
    // =======================================================

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
      // Roll back the club if membership creation fails
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

  // =========================================================
  // GET ALL CLUBS
  // =========================================================

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

  // =========================================================
  // JOIN CLUB
  // =========================================================

  async joinClub(
    userId: string,
    clubId: string,
  ) {
    // -------------------------------------------------------
    // CHECK CLUB
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // CHECK EXISTING MEMBERSHIP
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // CREATE MEMBERSHIP
    // -------------------------------------------------------
    //
    // Every newly joining user starts as an ordinary member.
    //
    // -------------------------------------------------------

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

    // =======================================================
    // CLUB JOIN NOTIFICATION
    // =======================================================
    //
    // Notify President(s) of the club.
    //
    // The actor cannot receive their own notification.
    //
    // =======================================================

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

  // =========================================================
  // LEAVE CLUB
  // =========================================================

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

    // =======================================================
    // PRESIDENT CANNOT LEAVE IF THEY ARE THE ONLY PRESIDENT
    // =======================================================

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

  // =========================================================
  // SUGGESTED CLUBS
  // =========================================================

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

  // =========================================================
  // MY CLUBS
  // =========================================================

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

  // =========================================================
  // GET ONE CLUB
  // =========================================================

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

  // =========================================================
  // GET CLUB MEMBERS
  // =========================================================

  async getMembers(
    clubId: string,
  ) {
    // -------------------------------------------------------
    // CHECK CLUB EXISTS
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // GET MEMBERS
    // -------------------------------------------------------

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

  // =========================================================
  // UPDATE CLUB
  // PRESIDENT ONLY
  // =========================================================

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

  // =========================================================
  // DELETE CLUB
  // PRESIDENT ONLY
  // =========================================================

  async deleteClub(
    userId: string,
    clubId: string,
  ) {
    await this.requirePresident(
      userId,
      clubId,
    );

    // -------------------------------------------------------
    // DELETE MEMBERSHIPS FIRST
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // DELETE CLUB
    // -------------------------------------------------------

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

  // =========================================================
  // REMOVE MEMBER
  // PRESIDENT / VP / MODERATOR
  // =========================================================

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

    // -------------------------------------------------------
    // CANNOT REMOVE PRESIDENT
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // HIGHER ROLE ONLY
    // -------------------------------------------------------
    //
    // Example:
    // VP can remove moderator/volunteer/member.
    // Moderator can remove volunteer/member.
    // Volunteer cannot remove anyone.
    //
    // -------------------------------------------------------

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

    // =======================================================
    // CLUB REMOVED NOTIFICATION
    // =======================================================

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

  // =========================================================
  // UPDATE MEMBER ROLE
  // =========================================================
  //
  // PRESIDENT:
  // Can manage every lower role.
  //
  // VICE PRESIDENT:
  // Can manage moderator, volunteer and member.
  //
  // MODERATOR:
  // Can manage volunteer and member.
  //
  // VOLUNTEER:
  // Cannot manage roles.
  //
  // MEMBER:
  // Cannot manage roles.
  //
  // =========================================================

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

    // -------------------------------------------------------
    // VALIDATE ROLE
    // -------------------------------------------------------

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

    // =======================================================
    // PRESIDENT ROLE
    // =======================================================
    //
    // Only the current president can transfer presidency.
    //
    // A president cannot simply demote themselves.
    //
    // When transferring presidency:
    //
    // current president -> vice_president
    // target member     -> president
    //
    // =======================================================

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

      // -----------------------------------------------------
      // Promote target to president first.
      // -----------------------------------------------------
      //
      // Then demote the old president.
      //
      // If demotion fails, attempt rollback.
      //
      // -----------------------------------------------------

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
        // Attempt rollback
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

      // =====================================================
      // NOTIFICATION TO NEW PRESIDENT
      // =====================================================

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

      // =====================================================
      // NOTIFICATION TO OLD PRESIDENT
      // =====================================================

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

    // =======================================================
    // PREVENT TARGET PRESIDENT FROM BEING DEMOTED
    // =======================================================

    if (
      targetMember.role ===
      'president'
    ) {
      throw new ForbiddenException(
        'The president can only transfer the presidency themselves.',
      );
    }

    // =======================================================
    // ACTOR MUST HAVE HIGHER AUTHORITY
    // =======================================================

    if (
      actorLevel <=
      targetCurrentLevel
    ) {
      throw new ForbiddenException(
        'You can only manage members with a lower role than yours.',
      );
    }

    // =======================================================
    // ACTOR CANNOT ASSIGN A ROLE EQUAL TO OR HIGHER
    // =======================================================

    if (
      newRoleLevel >=
      actorLevel
    ) {
      throw new ForbiddenException(
        'You cannot assign a role equal to or higher than your own role.',
      );
    }

    // =======================================================
    // UPDATE ROLE
    // =======================================================

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

    // =======================================================
    // CLUB ROLE CHANGED NOTIFICATION
    // =======================================================

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

  // =========================================================
  // PRIVATE: REQUIRE PRESIDENT
  // =========================================================

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

  // =========================================================
  // PRIVATE:
  // REQUIRE MEMBER MANAGEMENT PERMISSION
  // =========================================================
  //
  // President
  // Vice President
  // Moderator
  //
  // can remove lower-level members.
  //
  // =========================================================

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

  // =========================================================
  // PRIVATE:
  // REQUIRE ROLE MANAGEMENT PERMISSION
  // =========================================================

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