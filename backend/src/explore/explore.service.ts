import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

@Injectable()
export class ExploreService {
  async getExplore(
    userId: string,
    query?: string,
  ) {
    try {
      // Get current user
      const {
        data: currentUser,
        error: userError,
      } = await supabase
        .from('users')
        .select(`
          id,
          username,
          display_name,
          bio,
          interest,
          city,
          avatar_url
        `)
        .eq('id', userId)
        .single();

      if (userError || !currentUser) {
        throw new BadRequestException(
          'User not found.',
        );
      }

      const interests =
        Array.isArray(currentUser.interest)
          ? currentUser.interest
          : [];

      // Get users blocked by current user
      const {
        data: blockedByMe,
        error: blockedByMeError,
      } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (blockedByMeError) {
        throw new BadRequestException(
          blockedByMeError.message,
        );
      }

      // Get users who blocked current user
      const {
        data: blockedMe,
        error: blockedMeError,
      } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userId);

      if (blockedMeError) {
        throw new BadRequestException(
          blockedMeError.message,
        );
      }

      const blockedUserIds =
        new Set<string>([
          ...(blockedByMe ?? []).map(
            (block: any) =>
              block.blocked_id,
          ),
          ...(blockedMe ?? []).map(
            (block: any) =>
              block.blocker_id,
          ),
        ]);

      // Get users for recommendations
      const {
        data: allUsers,
        error: usersError,
      } = await supabase
        .from('users')
        .select(`
          id,
          username,
          display_name,
          bio,
          interest,
          city,
          avatar_url
        `)
        .neq('id', userId)
        .limit(100);

      if (usersError) {
        throw new BadRequestException(
          usersError.message,
        );
      }

      // People with your interests
      const peopleWithYourInterests =
        (allUsers ?? [])
          .filter((user: any) => {
            if (
              blockedUserIds.has(
                user.id,
              )
            ) {
              return false;
            }

            const userInterests =
              Array.isArray(user.interest)
                ? user.interest
                : [];

            return userInterests.some(
              (interest: string) =>
                interests.some(
                  (myInterest: string) =>
                    myInterest
                      .trim()
                      .toLowerCase() ===
                    interest
                      .trim()
                      .toLowerCase(),
                ),
            );
          })
          .slice(0, 10)
          .map((user: any) => ({
            id: user.id,
            username: user.username,
            displayName:
              user.display_name,
            bio: user.bio,
            city: user.city,
            avatarUrl:
              user.avatar_url,
            interests:
              Array.isArray(user.interest)
                ? user.interest
                : [],
          }));

      // Explore by vibe
      const vibeAliases: Record<
        string,
        string
      > = {
        tech: 'Technology',
        technology: 'Technology',
        coding: 'Coding',
        programming: 'Coding',
        photography: 'Photography',
        photo: 'Photography',
        hiking: 'Hiking',
        science: 'Science',
        movie: 'Movie',
        movies: 'Movie',
      };

      const vibeMap: Record<
        string,
        {
          name: string;
          slug: string;
          count: number;
        }
      > = {};

      const usersForVibes = [
        currentUser,
        ...(allUsers ?? []),
      ];

      for (const user of usersForVibes) {
        if (
          user.id !== userId &&
          blockedUserIds.has(user.id)
        ) {
          continue;
        }

        const userInterests =
          Array.isArray(user.interest)
            ? user.interest
            : [];

        const userVibes =
          new Set<string>();

        for (
          const interest of userInterests
        ) {
          if (
            typeof interest !==
            'string'
          ) {
            continue;
          }

          const value =
            interest.trim();

          if (!value) {
            continue;
          }

          const normalized =
            value.toLowerCase();

          const vibeName =
            vibeAliases[
              normalized
            ] ?? value;

          userVibes.add(
            vibeName,
          );
        }

        for (
          const vibeName of userVibes
        ) {
          const key =
            vibeName.toLowerCase();

          if (!vibeMap[key]) {
            vibeMap[key] = {
              name: vibeName,
              slug: key.replace(
                /\s+/g,
                '-',
              ),
              count: 0,
            };
          }

          vibeMap[key].count += 1;
        }
      }

      const exploreByVibe =
        Object.values(vibeMap)
          .sort((a, b) => {
            if (
              b.count !==
              a.count
            ) {
              return (
                b.count -
                a.count
              );
            }

            return a.name.localeCompare(
              b.name,
            );
          })
          .slice(0, 12);

      // Get clubs
      const {
        data: clubs,
        error: clubsError,
      } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          category,
          description,
          cover_image_url,
          created_by,
          created_at,
          updated_at
        `)
        .order(
          'created_at',
          {
            ascending: false,
          },
        )
        .limit(50);

      if (clubsError) {
        throw new BadRequestException(
          clubsError.message,
        );
      }

      const clubIds =
        (clubs ?? []).map(
          (club: any) => club.id,
        );

      let clubMembers: any[] = [];

      if (clubIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from('club_members')
          .select(`
            club_id,
            user_id
          `)
          .in(
            'club_id',
            clubIds,
          );

        if (error) {
          throw new BadRequestException(
            error.message,
          );
        }

        clubMembers =
          data ?? [];
      }

      const memberCountByClub =
        clubMembers.reduce(
          (
            result: Record<
              string,
              number
            >,
            member: any,
          ) => {
            result[
              member.club_id
            ] =
              (result[
                member.club_id
              ] ?? 0) + 1;

            return result;
          },
          {},
        );

      const joinedClubIds =
        new Set(
          clubMembers
            .filter(
              (member) =>
                member.user_id ===
                userId,
            )
            .map(
              (member) =>
                member.club_id,
            ),
        );

      const clubsYouMightLike =
        (clubs ?? [])
          .filter((club: any) => {
            if (
              club.created_by &&
              blockedUserIds.has(
                club.created_by,
              )
            ) {
              return false;
            }

            if (
              joinedClubIds.has(
                club.id,
              )
            ) {
              return false;
            }

            if (
              interests.length === 0
            ) {
              return true;
            }

            return interests.some(
              (interest: string) =>
                interest
                  .trim()
                  .toLowerCase() ===
                String(
                  club.category ?? '',
                )
                  .trim()
                  .toLowerCase(),
            );
          })
          .slice(0, 10)
          .map((club: any) => ({
            id: club.id,
            name: club.name,
            category:
              club.category,
            description:
              club.description,
            coverImageUrl:
              club.cover_image_url,
            memberCount:
              memberCountByClub[
                club.id
              ] ?? 0,
            isJoined: false,
            createdBy:
              club.created_by,
            createdAt:
              club.created_at,
            updatedAt:
              club.updated_at,
          }));

      // Get upcoming published events
      const {
        data: events,
        error: eventsError,
      } = await supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          what_to_expect,
          organizer_note,
          event_date,
          venue_name,
          venue_address,
          poster_url,
          latitude,
          longitude,
          organizer_id,
          status,
          created_at,
          updated_at
        `)
        .eq(
          'status',
          'published',
        )
        .order(
          'event_date',
          {
            ascending: true,
          },
        )
        .limit(20);

      if (eventsError) {
        throw new BadRequestException(
          eventsError.message,
        );
      }

      const eventIds =
        (events ?? []).map(
          (event: any) =>
            event.id,
        );

      let eventAttendees: any[] =
        [];

      if (
        eventIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from(
            'event_attendees',
          )
          .select(`
            event_id,
            user_id
          `)
          .in(
            'event_id',
            eventIds,
          );

        if (error) {
          throw new BadRequestException(
            error.message,
          );
        }

        eventAttendees =
          data ?? [];
      }

      const attendeeCountByEvent =
        eventAttendees.reduce(
          (
            result: Record<
              string,
              number
            >,
            attendee: any,
          ) => {
            result[
              attendee.event_id
            ] =
              (result[
                attendee.event_id
              ] ?? 0) + 1;

            return result;
          },
          {},
        );

      const userRsvpedEventIds =
        new Set(
          eventAttendees
            .filter(
              (attendee) =>
                attendee.user_id ===
                userId,
            )
            .map(
              (attendee) =>
                attendee.event_id,
            ),
        );

      const happeningAroundYou =
        (events ?? [])
          .filter((event: any) => {
            if (
              event.organizer_id &&
              blockedUserIds.has(
                event.organizer_id,
              )
            ) {
              return false;
            }

            if (
              !currentUser.city
            ) {
              return true;
            }

            const address =
              String(
                event.venue_address ??
                  '',
              ).toLowerCase();

            return address.includes(
              String(
                currentUser.city,
              ).toLowerCase(),
            );
          })
          .slice(0, 10)
          .map((event: any) => ({
            id: event.id,
            title: event.title,
            description:
              event.description,
            whatToExpect:
              event.what_to_expect,
            organizerNote:
              event.organizer_note,
            eventDate:
              event.event_date,
            venueName:
              event.venue_name,
            venueAddress:
              event.venue_address,
            posterUrl:
              event.poster_url,
            latitude:
              event.latitude,
            longitude:
              event.longitude,
            organizerId:
              event.organizer_id,
            attendeeCount:
              attendeeCountByEvent[
                event.id
              ] ?? 0,
            isRsvped:
              userRsvpedEventIds.has(
                event.id,
              ),
            createdAt:
              event.created_at,
            updatedAt:
              event.updated_at,
          }));

      // Get recent public posts
      const {
        data: posts,
        error: postsError,
      } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          created_at,
          updated_at,
          is_deleted,
          visibility
        `)
        .eq(
          'is_deleted',
          false,
        )
        .eq(
          'visibility',
          'public',
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        )
        .limit(30);

      if (postsError) {
        throw new BadRequestException(
          postsError.message,
        );
      }

      const visiblePosts =
        (posts ?? []).filter(
          (post: any) =>
            !blockedUserIds.has(
              post.user_id,
            ),
        );

      const postIds =
        visiblePosts.map(
          (post: any) =>
            post.id,
        );

      // Get post authors
      const postUserIds = [
        ...new Set(
          visiblePosts.map(
            (post: any) =>
              post.user_id,
          ),
        ),
      ];

      let postAuthors: any[] =
        [];

      if (
        postUserIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from('users')
          .select(`
            id,
            username,
            display_name,
            avatar_url
          `)
          .in(
            'id',
            postUserIds,
          );

        if (error) {
          throw new BadRequestException(
            error.message,
          );
        }

        postAuthors =
          data ?? [];
      }

      const authorById =
        postAuthors.reduce(
          (
            result: Record<
              string,
              any
            >,
            author: any,
          ) => {
            result[
              author.id
            ] = author;

            return result;
          },
          {},
        );

      // Get post media
      let postMediaRows: any[] =
        [];

      if (
        postIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from(
            'post_attachments',
          )
          .select(`
            post_id,
            media_id,
            sort_order,
            media_files (
              id,
              storage_path,
              original_name,
              mime_type,
              size_bytes,
              width,
              height,
              duration_seconds
            )
          `)
          .in(
            'post_id',
            postIds,
          )
          .order(
            'sort_order',
            {
              ascending: true,
            },
          );

        if (error) {
          throw new BadRequestException(
            error.message,
          );
        }

        postMediaRows =
          data ?? [];
      }

      const mediaByPost =
        postMediaRows.reduce(
          (
            result: Record<
              string,
              any[]
            >,
            row: any,
          ) => {
            if (
              !result[
                row.post_id
              ]
            ) {
              result[
                row.post_id
              ] = [];
            }

            const media =
              Array.isArray(
                row.media_files,
              )
                ? row.media_files[0]
                : row.media_files;

            if (media) {
              result[
                row.post_id
              ].push({
                id: media.id,
                originalName:
                  media.original_name,
                mimeType:
                  media.mime_type,
                sizeBytes:
                  media.size_bytes,
                width:
                  media.width,
                height:
                  media.height,
                durationSeconds:
                  media.duration_seconds,
                sortOrder:
                  row.sort_order,
              });
            }

            return result;
          },
          {},
        );

      // Get post counts
      let likes: any[] = [];
      let comments: any[] = [];
      let saves: any[] = [];
      let views: any[] = [];

      if (
        postIds.length > 0
      ) {
        const [
          likesResult,
          commentsResult,
          savesResult,
          viewsResult,
        ] =
          await Promise.all([
            supabase
              .from('post_likes')
              .select(
                'post_id, user_id',
              )
              .in(
                'post_id',
                postIds,
              ),

            supabase
              .from(
                'post_comments',
              )
              .select(
                'post_id, user_id',
              )
              .in(
                'post_id',
                postIds,
              ),

            supabase
              .from('post_saves')
              .select(
                'post_id, user_id',
              )
              .in(
                'post_id',
                postIds,
              ),

            supabase
              .from('post_views')
              .select(
                'post_id, user_id',
              )
              .in(
                'post_id',
                postIds,
              ),
          ]);

        if (likesResult.error) {
          throw new BadRequestException(
            likesResult.error.message,
          );
        }

        if (
          commentsResult.error
        ) {
          throw new BadRequestException(
            commentsResult.error.message,
          );
        }

        if (savesResult.error) {
          throw new BadRequestException(
            savesResult.error.message,
          );
        }

        if (viewsResult.error) {
          throw new BadRequestException(
            viewsResult.error.message,
          );
        }

        likes =
          likesResult.data ?? [];

        comments =
          commentsResult.data ??
          [];

        saves =
          savesResult.data ?? [];

        views =
          viewsResult.data ?? [];
      }

      // Build picked for you
      const pickedForYou =
        visiblePosts
          .map((post: any) => {
            const postLikes =
              likes.filter(
                (like) =>
                  like.post_id ===
                  post.id,
              );

            const postComments =
              comments.filter(
                (comment) =>
                  comment.post_id ===
                  post.id,
              );

            const postViews =
              views.filter(
                (view) =>
                  view.post_id ===
                  post.id,
              );

            const postSaves =
              saves.filter(
                (save) =>
                  save.post_id ===
                  post.id,
              );

            const author =
              authorById[
                post.user_id
              ];

            return {
              id: post.id,
              userId:
                post.user_id,

              author: author
                ? {
                    id: author.id,
                    username:
                      author.username,
                    displayName:
                      author.display_name,
                    avatarUrl:
                      author.avatar_url,
                  }
                : null,

              content:
                post.content,

              media:
                mediaByPost[
                  post.id
                ] ?? [],

              createdAt:
                post.created_at,

              updatedAt:
                post.updated_at,

              likeCount:
                postLikes.length,

              commentCount:
                postComments.length,

              viewCount:
                postViews.length,

              saveCount:
                postSaves.length,

              isLiked:
                postLikes.some(
                  (like) =>
                    like.user_id ===
                    userId,
                ),

              isSaved:
                postSaves.some(
                  (save) =>
                    save.user_id ===
                    userId,
                ),
            };
          })
          .slice(0, 10);

      // Build reels
      const reels: any[] = [];

      for (
        const post of visiblePosts
      ) {
        const media =
          mediaByPost[
            post.id
          ] ?? [];

        const videoMedia =
          media.filter(
            (item: any) =>
              typeof item.mimeType ===
                'string' &&
              item.mimeType
                .toLowerCase()
                .startsWith(
                  'video/',
                ),
          );

        if (
          videoMedia.length === 0
        ) {
          continue;
        }

        const postLikes =
          likes.filter(
            (like) =>
              like.post_id ===
              post.id,
          );

        const postComments =
          comments.filter(
            (comment) =>
              comment.post_id ===
              post.id,
          );

        const postViews =
          views.filter(
            (view) =>
              view.post_id ===
              post.id,
          );

        const postSaves =
          saves.filter(
            (save) =>
              save.post_id ===
              post.id,
          );

        const author =
          authorById[
            post.user_id
          ];

        reels.push({
          id: post.id,
          userId:
            post.user_id,

          author: author
            ? {
                id: author.id,
                username:
                  author.username,
                displayName:
                  author.display_name,
                avatarUrl:
                  author.avatar_url,
              }
            : null,

          content:
            post.content,

          media:
            videoMedia,

          createdAt:
            post.created_at,

          updatedAt:
            post.updated_at,

          likeCount:
            postLikes.length,

          commentCount:
            postComments.length,

          viewCount:
            postViews.length,

          saveCount:
            postSaves.length,

          isLiked:
            postLikes.some(
              (like) =>
                like.user_id ===
                userId,
            ),

          isSaved:
            postSaves.some(
              (save) =>
                save.user_id ===
                userId,
            ),
        });

        if (
          reels.length >= 10
        ) {
          break;
        }
      }

      // Build trending
      const trending =
        [...pickedForYou]
          .sort(
            (a, b) =>
              b.likeCount +
              b.commentCount +
              b.viewCount +
              b.saveCount -
              (a.likeCount +
                a.commentCount +
                a.viewCount +
                a.saveCount),
          )
          .slice(0, 10);

      // Featured reel
      const featuredReel =
        [...reels]
          .sort((a, b) => {
            const scoreA =
              a.likeCount +
              a.commentCount +
              a.viewCount +
              a.saveCount;

            const scoreB =
              b.likeCount +
              b.commentCount +
              b.viewCount +
              b.saveCount;

            if (
              scoreB !== scoreA
            ) {
              return (
                scoreB - scoreA
              );
            }

            return (
              new Date(
                b.createdAt,
              ).getTime() -
              new Date(
                a.createdAt,
              ).getTime()
            );
          })[0] ?? null;

      // Search
      let searchResults:
        | null
        | {
            query: string;
            people: any[];
            clubs: any[];
            events: any[];
            posts: any[];
          } = null;

      if (
        query &&
        query.trim()
      ) {
        const search =
          query
            .trim()
            .toLowerCase();

        // Search people
        const {
          data: searchedPeople,
          error:
            searchedPeopleError,
        } = await supabase
          .from('users')
          .select(`
            id,
            username,
            display_name,
            bio,
            city,
            avatar_url,
            interest
          `)
          .neq('id', userId)
          .or(
            `username.ilike.%${search}%,display_name.ilike.%${search}%,bio.ilike.%${search}%,city.ilike.%${search}%`,
          )
          .limit(20);

        if (searchedPeopleError) {
          throw new BadRequestException(
            searchedPeopleError.message,
          );
        }

        const searchPeople =
          (searchedPeople ?? [])
            .filter(
              (person: any) =>
                !blockedUserIds.has(
                  person.id,
                ),
            )
            .map((person: any) => ({
              id: person.id,
              username:
                person.username,
              displayName:
                person.display_name,
              bio: person.bio,
              city: person.city,
              avatarUrl:
                person.avatar_url,
              interests:
                Array.isArray(
                  person.interest,
                )
                  ? person.interest
                  : [],
            }));

        // Search clubs
        const {
          data: searchedClubs,
          error:
            searchedClubsError,
        } = await supabase
          .from('clubs')
          .select(`
            id,
            name,
            category,
            description,
            cover_image_url,
            created_by,
            created_at,
            updated_at
          `)
          .or(
            `name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`,
          )
          .order(
            'created_at',
            {
              ascending: false,
            },
          )
          .limit(20);

        if (searchedClubsError) {
          throw new BadRequestException(
            searchedClubsError.message,
          );
        }

        const searchClubIds =
          (searchedClubs ?? [])
            .map(
              (club: any) =>
                club.id,
            );

        let searchClubMembers:
          any[] = [];

        if (
          searchClubIds.length > 0
        ) {
          const {
            data,
            error,
          } = await supabase
            .from(
              'club_members',
            )
            .select(`
              club_id,
              user_id
            `)
            .in(
              'club_id',
              searchClubIds,
            );

          if (error) {
            throw new BadRequestException(
              error.message,
            );
          }

          searchClubMembers =
            data ?? [];
        }

        const searchMemberCountByClub =
          searchClubMembers.reduce(
            (
              result: Record<
                string,
                number
              >,
              member: any,
            ) => {
              result[
                member.club_id
              ] =
                (result[
                  member.club_id
                ] ?? 0) + 1;

              return result;
            },
            {},
          );

        const searchJoinedClubIds =
          new Set(
            searchClubMembers
              .filter(
                (member) =>
                  member.user_id ===
                  userId,
              )
              .map(
                (member) =>
                  member.club_id,
              ),
          );

        const searchClubs =
          (searchedClubs ?? [])
            .filter(
              (club: any) => {
                if (
                  club.created_by &&
                  blockedUserIds.has(
                    club.created_by,
                  )
                ) {
                  return false;
                }

                return true;
              },
            )
            .map((club: any) => ({
              id: club.id,
              name: club.name,
              category:
                club.category,
              description:
                club.description,
              coverImageUrl:
                club.cover_image_url,
              memberCount:
                searchMemberCountByClub[
                  club.id
                ] ?? 0,
              isJoined:
                searchJoinedClubIds.has(
                  club.id,
                ),
              createdBy:
                club.created_by,
              createdAt:
                club.created_at,
              updatedAt:
                club.updated_at,
            }));

        // Search events
        const {
          data: searchedEvents,
          error:
            searchedEventsError,
        } = await supabase
          .from('events')
          .select(`
            id,
            title,
            description,
            what_to_expect,
            organizer_note,
            event_date,
            venue_name,
            venue_address,
            poster_url,
            latitude,
            longitude,
            organizer_id,
            status,
            created_at,
            updated_at
          `)
          .eq(
            'status',
            'published',
          )
          .or(
            `title.ilike.%${search}%,description.ilike.%${search}%,what_to_expect.ilike.%${search}%,venue_name.ilike.%${search}%,venue_address.ilike.%${search}%`,
          )
          .order(
            'event_date',
            {
              ascending: true,
            },
          )
          .limit(20);

        if (searchedEventsError) {
          throw new BadRequestException(
            searchedEventsError.message,
          );
        }

        const searchEventIds =
          (searchedEvents ?? [])
            .map(
              (event: any) =>
                event.id,
            );

        let searchEventAttendees:
          any[] = [];

        if (
          searchEventIds.length > 0
        ) {
          const {
            data,
            error,
          } = await supabase
            .from(
              'event_attendees',
            )
            .select(`
              event_id,
              user_id
            `)
            .in(
              'event_id',
              searchEventIds,
            );

          if (error) {
            throw new BadRequestException(
              error.message,
            );
          }

          searchEventAttendees =
            data ?? [];
        }

        const searchAttendeeCountByEvent =
          searchEventAttendees.reduce(
            (
              result: Record<
                string,
                number
              >,
              attendee: any,
            ) => {
              result[
                attendee.event_id
              ] =
                (result[
                  attendee.event_id
                ] ?? 0) + 1;

              return result;
            },
            {},
          );

        const searchUserRsvpedEventIds =
          new Set(
            searchEventAttendees
              .filter(
                (attendee) =>
                  attendee.user_id ===
                  userId,
              )
              .map(
                (attendee) =>
                  attendee.event_id,
              ),
          );

        const searchEvents =
          (searchedEvents ?? [])
            .filter(
              (event: any) =>
                !event.organizer_id ||
                !blockedUserIds.has(
                  event.organizer_id,
                ),
            )
            .map((event: any) => ({
              id: event.id,
              title: event.title,
              description:
                event.description,
              whatToExpect:
                event.what_to_expect,
              organizerNote:
                event.organizer_note,
              eventDate:
                event.event_date,
              venueName:
                event.venue_name,
              venueAddress:
                event.venue_address,
              posterUrl:
                event.poster_url,
              latitude:
                event.latitude,
              longitude:
                event.longitude,
              organizerId:
                event.organizer_id,
              attendeeCount:
                searchAttendeeCountByEvent[
                  event.id
                ] ?? 0,
              isRsvped:
                searchUserRsvpedEventIds.has(
                  event.id,
                ),
              createdAt:
                event.created_at,
              updatedAt:
                event.updated_at,
            }));

        // Search public posts
        const {
          data: searchedPosts,
          error:
            searchedPostsError,
        } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            content,
            created_at,
            updated_at,
            is_deleted,
            visibility
          `)
          .ilike(
            'content',
            `%${search}%`,
          )
          .eq(
            'is_deleted',
            false,
          )
          .eq(
            'visibility',
            'public',
          )
          .order(
            'created_at',
            {
              ascending: false,
            },
          )
          .limit(20);

        if (searchedPostsError) {
          throw new BadRequestException(
            searchedPostsError.message,
          );
        }

        const visibleSearchPosts =
          (searchedPosts ?? [])
            .filter(
              (post: any) =>
                !blockedUserIds.has(
                  post.user_id,
                ),
            );

        const searchPostUserIds = [
          ...new Set(
            visibleSearchPosts.map(
              (post: any) =>
                post.user_id,
            ),
          ),
        ];

        let searchPostAuthors:
          any[] = [];

        if (
          searchPostUserIds.length >
          0
        ) {
          const {
            data,
            error,
          } = await supabase
            .from('users')
            .select(`
              id,
              username,
              display_name,
              avatar_url
            `)
            .in(
              'id',
              searchPostUserIds,
            );

          if (error) {
            throw new BadRequestException(
              error.message,
            );
          }

          searchPostAuthors =
            data ?? [];
        }

        const searchAuthorById =
          searchPostAuthors.reduce(
            (
              result: Record<
                string,
                any
              >,
              author: any,
            ) => {
              result[
                author.id
              ] = author;

              return result;
            },
            {},
          );

        const searchPostIds =
          visibleSearchPosts.map(
            (post: any) =>
              post.id,
          );

        let searchPostMediaRows:
          any[] = [];

        if (
          searchPostIds.length > 0
        ) {
          const {
            data,
            error,
          } = await supabase
            .from(
              'post_attachments',
            )
            .select(`
              post_id,
              media_id,
              sort_order,
              media_files (
                id,
                storage_path,
                original_name,
                mime_type,
                size_bytes,
                width,
                height,
                duration_seconds
              )
            `)
            .in(
              'post_id',
              searchPostIds,
            )
            .order(
              'sort_order',
              {
                ascending: true,
              },
            );

          if (error) {
            throw new BadRequestException(
              error.message,
            );
          }

          searchPostMediaRows =
            data ?? [];
        }

        const searchMediaByPost =
          searchPostMediaRows.reduce(
            (
              result: Record<
                string,
                any[]
              >,
              row: any,
            ) => {
              if (
                !result[
                  row.post_id
                ]
              ) {
                result[
                  row.post_id
                ] = [];
              }

              const media =
                Array.isArray(
                  row.media_files,
                )
                  ? row.media_files[0]
                  : row.media_files;

              if (media) {
                result[
                  row.post_id
                ].push({
                  id: media.id,
                  originalName:
                    media.original_name,
                  mimeType:
                    media.mime_type,
                  sizeBytes:
                    media.size_bytes,
                  width:
                    media.width,
                  height:
                    media.height,
                  durationSeconds:
                    media.duration_seconds,
                  sortOrder:
                    row.sort_order,
                });
              }

              return result;
            },
            {},
          );

        const searchPosts =
          visibleSearchPosts.map(
            (post: any) => {
              const author =
                searchAuthorById[
                  post.user_id
                ];

              return {
                id: post.id,
                userId:
                  post.user_id,

                author: author
                  ? {
                      id: author.id,
                      username:
                        author.username,
                      displayName:
                        author.display_name,
                      avatarUrl:
                        author.avatar_url,
                    }
                  : null,

                content:
                  post.content,

                media:
                  searchMediaByPost[
                    post.id
                  ] ?? [],

                createdAt:
                  post.created_at,

                updatedAt:
                  post.updated_at,
              };
            },
          );

        searchResults = {
          query:
            query.trim(),

          people:
            searchPeople,

          clubs:
            searchClubs,

          events:
            searchEvents,

          posts:
            searchPosts,
        };
      }

      // Community icebreaker
      const icebreakers = [
        'What is something interesting you learned this week?',
        'What are you currently working on?',
        'What is your favorite place in your city?',
        'What skill would you like to learn next?',
        'What event are you looking forward to?',
      ];

      const icebreaker =
        icebreakers[
          new Date().getDate() %
            icebreakers.length
        ];

      // Final response
      return {
        success: true,

        data: {
          pickedForYou:
            pickedForYou,

          reels,

          featuredReel,

          exploreByVibe,

          peopleWithYourInterests:
            peopleWithYourInterests,

          clubsYouMightLike:
            clubsYouMightLike,

          happeningAroundYou:
            happeningAroundYou,

          trending,

          communityIcebreaker: {
            text: icebreaker,
          },

          search:
            searchResults,
        },
      };
    } catch (error) {
      if (
        error instanceof
        BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to load Explore data.',
      );
    }
  }
}