import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
  ) {}

  // =========================================================
  // CREATE POST
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post()
  createPost(
    @CurrentUser() user: any,
    @Body('content') content: string,
  ) {
    return this.postsService.createPost(
      user.id,
      content,
    );
  }

  // =========================================================
  // GET POSTS
  // Global fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get()
  getPosts(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {
    return this.postsService.getPosts(
      pagination,
      user.id,
    );
  }

  // =========================================================
  // GET SINGLE POST
  // Global fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':postId')
  getPostById(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.getPostById(
      postId,
      user.id,
    );
  }

  // =========================================================
  // VIEW POST
  // 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 100,
      ttl: 60 * 1000,
    },
  })
  @Post(':postId/view')
  viewPost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.viewPost(
      user.id,
      postId,
    );
  }

  // =========================================================
  // UPDATE POST
  // Global fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Patch(':postId')
  updatePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(
      user.id,
      postId,
      dto,
    );
  }

  // =========================================================
  // DELETE POST
  // Global fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete(':postId')
  deletePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.deletePost(
      user.id,
      postId,
    );
  }

  // =========================================================
  // LIKE POST
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Post(':postId/like')
  likePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.likePost(
      user.id,
      postId,
    );
  }

  // =========================================================
  // UNLIKE POST
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Delete(':postId/like')
  unlikePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.unlikePost(
      user.id,
      postId,
    );
  }

  // =========================================================
  // SAVE POST
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Post(':postId/save')
  savePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.savePost(
      user.id,
      postId,
    );
  }

  // =========================================================
  // UNSAVE POST
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Delete(':postId/save')
  unsavePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.unsavePost(
      user.id,
      postId,
    );
  }
}