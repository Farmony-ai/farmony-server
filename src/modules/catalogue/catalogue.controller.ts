import { Controller, Post, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { UpdateCatalogueDto } from './dto/update-catalogue.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Catalogue') 
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post()
  create(@Body() dto: CreateCatalogueDto) {
    return this.catalogueService.create(dto);
  }

  @Get()
  findAll(@Query('category') category?: string) {
    return this.catalogueService.findAll(category);
  }

  @Get('categories')
  findCategories(@Query('category') category?: string) {
    return this.catalogueService.findCategories(category);
  }

  @Get('hierarchy')
  getHierarchy() {
    return this.catalogueService.getHierarchy();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogueService.findById(id);
  }

  @Get(':id/subcategories')
  findSubcategories(@Param('id') id: string) {
    return this.catalogueService.findSubcategories(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogueDto) {
    return this.catalogueService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogueService.delete(id);
  }
}