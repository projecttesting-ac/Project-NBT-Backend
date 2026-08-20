import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { supabase } from '../config/supabase';

@Injectable()
export class ClubsService {
  async findAll(userId: string) {
  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new BadRequestException(error.message);
  }

  const clubsWithDetails = await Promise.all(
    clubs.map(async (club) => {
      // Get total member count
      const { count: memberCount, error: countError } =
        await supabase
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

      // Check whether current user joined
      const { data: membership, error: membershipError } =
        await supabase
          .from('club_members')
          .select('id')
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
        description: club.description,
        coverImageUrl: club.cover_image_url,
        memberCount: memberCount ?? 0,
        isJoined: !!membership,
        createdAt: club.created_at,
        updatedAt: club.updated_at,
      };
    }),
  );

  return {
    success: true,
    clubs: clubsWithDetails,
  };
}
  async joinClub(
  userId: string,
  clubId: string,
) {
  // Check that the club exists
  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .maybeSingle();

  if (clubError) {
    throw new BadRequestException(clubError.message);
  }

  if (!club) {
    throw new BadRequestException('Club not found.');
  }

  // Check whether the user already joined
  const { data: existingMember, error: memberError } =
    await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

  if (memberError) {
    throw new BadRequestException(memberError.message);
  }

  if (existingMember) {
    return {
      success: true,
      message: 'You have already joined this club.',
    };
  }

  // Add user to club
  const { error: joinError } = await supabase
    .from('club_members')
    .insert({
      club_id: clubId,
      user_id: userId,
    });

  if (joinError) {
    throw new BadRequestException(joinError.message);
  }

  return {
    success: true,
    message: 'Joined club successfully.',
  };
}
async leaveClub(
  userId: string,
  clubId: string,
) {
  const { data: existingMember, error: memberError } =
    await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

  if (memberError) {
    throw new BadRequestException(memberError.message);
  }

  if (!existingMember) {
    throw new BadRequestException(
      'You have not joined this club.',
    );
  }

  const { error: deleteError } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new BadRequestException(deleteError.message);
  }

  return {
    success: true,
    message: 'Left club successfully.',
  };
}
async getSuggested(userId: string) {
  // Get current user's interests
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('interest')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new BadRequestException('User not found.');
  }

  const interests = Array.isArray(user.interest)
    ? user.interest
    : [];

  // Get all clubs
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('*')
    .order('created_at', { ascending: false });

  if (clubsError) {
    throw new BadRequestException(clubsError.message);
  }

  // Match club category with user's interests
  const suggestedClubs = clubs.filter((club) =>
    interests.some(
      (interest: string) =>
        interest.trim().toLowerCase() ===
        club.category.trim().toLowerCase(),
    ),
  );

  const clubsWithDetails = await Promise.all(
    suggestedClubs.map(async (club) => {
      const { count: memberCount, error: countError } =
        await supabase
          .from('club_members')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('club_id', club.id);

      if (countError) {
        throw new BadRequestException(countError.message);
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from('club_members')
          .select('id')
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
        description: club.description,
        coverImageUrl: club.cover_image_url,
        memberCount: memberCount ?? 0,
        isJoined: !!membership,
        createdAt: club.created_at,
        updatedAt: club.updated_at,
      };
    }),
  );

  return {
    success: true,
    clubs: clubsWithDetails,
  };
}
async getMyClubs(userId: string) {
  // Get clubs joined by current user
  const { data: memberships, error: membershipError } =
    await supabase
      .from('club_members')
      .select(`
        id,
        joined_at,
        clubs (
          id,
          name,
          category,
          description,
          cover_image_url,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', {
        ascending: false,
      });

  if (membershipError) {
    throw new BadRequestException(
      membershipError.message,
    );
  }

  const clubs = await Promise.all(
    memberships.map(async (membership: any) => {
      const club = membership.clubs;

      if (!club) {
        return null;
      }

      // Get member count
      const { count: memberCount, error: countError } =
        await supabase
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

      return {
        id: club.id,
        name: club.name,
        category: club.category,
        description: club.description,
        coverImageUrl: club.cover_image_url,
        memberCount: memberCount ?? 0,
        isJoined: true,
        joinedAt: membership.joined_at,
        createdAt: club.created_at,
        updatedAt: club.updated_at,
      };
    }),
  );

  return {
    success: true,
    clubs: clubs.filter(Boolean),
  };
}
async getOne(
  userId: string,
  clubId: string,
) {
  // Get club
  const { data: club, error: clubError } =
    await supabase
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

  // Get member count
  const { count: memberCount, error: countError } =
    await supabase
      .from('club_members')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('club_id', clubId);

  if (countError) {
    throw new BadRequestException(
      countError.message,
    );
  }

  // Check current user's membership
  const { data: membership, error: membershipError } =
    await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
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
      category: club.category,
      description: club.description,
      coverImageUrl: club.cover_image_url,
      memberCount: memberCount ?? 0,
      isJoined: !!membership,
      createdAt: club.created_at,
      updatedAt: club.updated_at,
    },
  };
}
async getMembers(clubId: string) {
  // Check that the club exists
  const { data: club, error: clubError } =
    await supabase
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

  // Get club members
  const { data: members, error: membersError } =
    await supabase
      .from('club_members')
      .select(`
        id,
        joined_at,
        user_id,
        users (
          id,
          username,
          display_name,
          bio,
          avatar_url,
          city
        )
      `)
      .eq('club_id', clubId)
      .order('joined_at', {
        ascending: true,
      });

  if (membersError) {
    throw new BadRequestException(
      membersError.message,
    );
  }

  const safeMembers = members.map((member: any) => ({
    id: member.users?.id,
    username: member.users?.username,
    displayName: member.users?.display_name,
    bio: member.users?.bio,
    avatarUrl: member.users?.avatar_url,
    city: member.users?.city,
    joinedAt: member.joined_at,
  }));

  return {
    success: true,
    members: safeMembers,
  };
}
}