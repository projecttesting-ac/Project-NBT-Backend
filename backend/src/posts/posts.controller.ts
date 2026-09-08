import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
}