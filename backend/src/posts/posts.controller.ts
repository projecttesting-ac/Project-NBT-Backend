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

import { CreatePostDto } from './dto/create-post.dto';
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
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(
      user.id,
      dto,
    );
  }

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

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Delete(':postId/like')
  dislikePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    return this.postsService.dislikePost(
      user.id,
      postId,
    );
  }

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