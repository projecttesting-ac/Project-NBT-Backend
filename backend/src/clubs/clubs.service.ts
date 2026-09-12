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

    // Creator becomes the first ADMIN
    const {
      error: memberError,
    } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: userId,
        role: 'admin',
      });

    if (memberError) {
      // Roll back the club if member creation fails
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
        createdBy: club.created_by,
        createdAt: club.created_at,
        updatedAt: club.updated_at,
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
              .eq('club_id', club.id);

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
              .select('id, role')
              .eq('club_id', club.id)
              .eq('user_id', userId)
              .maybeSingle();

            if (membershipError) {
              throw new BadRequestException(
                membershipError.message,
              );
            }

            return {
              id: club.id,
              name: club.name,
              category: club.category,
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
      clubs: clubsWithDetails,
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
      .eq('club_id', clubId)
      .eq('user_id', userId)
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
    // Notify every admin of the club.
    //
    // The joining user will never receive their own
    // notification because NotificationsService protects
    // against actorId === userId.
    //

    const {
      data: admins,
      error: adminsError,
    } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('role', 'admin');

    if (!adminsError && admins) {
      await Promise.all(
        admins.map((admin) =>
          this.notificationsService
            .tryCreateNotification(
              admin.user_id,
              'CLUB_JOIN',
              'New club member',
              'Someone joined your club.',
              userId,
              clubId,
              'CLUB',
            ),
        ),
      );
    } else if (adminsError) {
      // Do not fail the join if notification
      // recipient lookup fails.
      console.error(
        'Unable to find club admins for notification:',
        adminsError.message,
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
      .select('id, role')
      .eq('club_id', clubId)
      .eq('user_id', userId)
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

    // If admin is leaving,
    // make sure another admin exists
    if (membership.role === 'admin') {
      const {
        count: adminCount,
        error: adminError,
      } = await supabase
        .from('club_members')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('club_id', clubId)
        .eq('role', 'admin');

      if (adminError) {
        throw new BadRequestException(
          adminError.message,
        );
      }

      if (
        (adminCount ?? 0) <= 1
      ) {
        throw new BadRequestException(
          'You are the only admin. Promote another member to admin before leaving the club.',
        );
      }
    }

    const {
      error: deleteError,
    } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

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

    if (userError || !user) {
      throw new BadRequestException(
        'User not found.',
      );
    }

    const interests =
      Array.isArray(user.interest)
        ? user.interest
        : [];

    const {
      data: clubs,
      error: clubsError,
    } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    if (clubsError) {
      throw new BadRequestException(
        clubsError.message,
      );
    }

    const suggestedClubs =
      (clubs ?? []).filter(
        (club) =>
          interests.some(
            (interest: string) =>
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
    // Check club exists
    const {
      data: club,
      error: clubError,
    } = await supabase
      .from('clubs')
      .select('id')
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
  // ADMIN ONLY
  // PATCH /api/clubs/:clubId
  // =========================================================

  async updateClub(
    userId: string,
    clubId: string,
    dto: UpdateClubDto,
  ) {
    await this.requireAdmin(
      userId,
      clubId,
    );

    const updateData: any = {};

    if (dto.name !== undefined) {
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
      dto.description !== undefined
    ) {
      updateData.description =
        dto.description;
    }

    if (
      dto.coverImageUrl !== undefined
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
      .update(updateData)
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
  // ADMIN ONLY
  // DELETE /api/clubs/:clubId
  // =========================================================

  async deleteClub(
    userId: string,
    clubId: string,
  ) {
    await this.requireAdmin(
      userId,
      clubId,
    );

    // Delete memberships first
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

    // Delete club
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
  // ADMIN OR VOLUNTEER
  // DELETE /api/clubs/:clubId/members/:userId
  // =========================================================

  async removeMember(
    userId: string,
    clubId: string,
    targetUserId: string,
  ) {
    const actorRole =
      await this.requireAdminOrVolunteer(
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

    // Nobody can remove an admin
    if (
      targetMember.role === 'admin'
    ) {
      throw new ForbiddenException(
        'Club admins cannot be removed as members.',
      );
    }

    // Volunteer can remove normal members,
    // but cannot remove another volunteer.
    if (
      actorRole === 'volunteer' &&
      targetMember.role ===
        'volunteer'
    ) {
      throw new ForbiddenException(
        'Volunteers cannot remove other volunteers.',
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
  // ADMIN ONLY
  // PATCH /api/clubs/:clubId/members/:userId/role
  // =========================================================

  async updateMemberRole(
    userId: string,
    clubId: string,
    targetUserId: string,
    role: string,
  ) {
    await this.requireAdmin(
      userId,
      clubId,
    );

    const allowedRoles = [
      'admin',
      'volunteer',
      'member',
    ];

    if (
      !allowedRoles.includes(
        role,
      )
    ) {
      throw new BadRequestException(
        'Invalid role. Allowed roles: admin, volunteer, member.',
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

    // -------------------------------------------------------
    // PREVENT ONLY ADMIN FROM DEMOTING THEMSELVES
    // -------------------------------------------------------

    if (
      targetUserId === userId &&
      targetMember.role === 'admin' &&
      role !== 'admin'
    ) {
      const {
        count: adminCount,
        error: adminError,
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
          'admin',
        );

      if (adminError) {
        throw new BadRequestException(
          adminError.message,
        );
      }

      if (
        (adminCount ?? 0) <= 1
      ) {
        throw new BadRequestException(
          'You are the only admin. Promote another member to admin first.',
        );
      }
    }

    // -------------------------------------------------------
    // UPDATE ROLE
    // -------------------------------------------------------

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
  // PRIVATE: REQUIRE ADMIN
  // =========================================================

  private async requireAdmin(
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
      'admin'
    ) {
      throw new ForbiddenException(
        'Only the club admin can perform this action.',
      );
    }

    return membership.role;
  }

  // =========================================================
  // PRIVATE: REQUIRE ADMIN OR VOLUNTEER
  // =========================================================

  private async requireAdminOrVolunteer(
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
      membership.role !== 'admin' &&
      membership.role !==
        'volunteer'
    ) {
      throw new ForbiddenException(
        'Only the club admin or a club volunteer can perform this action.',
      );
    }

    return membership.role;
  }
}