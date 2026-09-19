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

import { CommentsService } from './comments.service';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Post()
  createComment(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    // create a comment or reply
    return this.commentsService.createComment(
      user.id,
      postId,
      dto.content,
      dto.parentCommentId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getComments(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ) {
    // get comments for the post
    return this.commentsService.getComments(
      postId,
      user.id,
      pagination,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Patch(':commentId')
  updateComment(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    // update the comment
    return this.commentsService.updateComment(
      user.id,
      postId,
      commentId,
      dto.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Delete(':commentId')
  deleteComment(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    // delete the comment or reply
    return this.commentsService.deleteComment(
      user.id,
      postId,
      commentId,
    );
  }
}