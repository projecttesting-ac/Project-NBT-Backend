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

  // =========================================================
  // CREATE COMMENT / REPLY
  // 30 requests / 1 minute
  // =========================================================

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
    return this.commentsService.createComment(
      user.id,
      postId,
      dto.content,
      dto.parentCommentId,
    );
  }

  // =========================================================
  // GET COMMENTS
  // Global fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get()
  getComments(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.commentsService.getComments(
      postId,
      user.id,
      pagination,
    );
  }

  // =========================================================
  // UPDATE COMMENT / REPLY
  // 30 requests / 1 minute
  // =========================================================

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
    return this.commentsService.updateComment(
      user.id,
      postId,
      commentId,
      dto.content,
    );
  }

  // =========================================================
  // DELETE COMMENT / REPLY
  // 30 requests / 1 minute
  // =========================================================

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
    return this.commentsService.deleteComment(
      user.id,
      postId,
      commentId,
    );
  }
}