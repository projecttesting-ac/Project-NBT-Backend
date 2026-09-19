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
    // create a new post
    return this.postsService.createPost(
      user.id,
      content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getPosts(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {
    // get posts with pagination
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
    // get a single post
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
    // record a post view
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
    // update the post
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
    // delete the post
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
    // like the post
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
  unlikePost(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
  ) {
    // remove the like
    return this.postsService.unlikePost(
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
    // save the post
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
    // remove the saved post
    return this.postsService.unsavePost(
      user.id,
      postId,
    );
  }
}