import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { ExecutionsController } from './executions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ExecutionsController],
    providers: [ExecutionsService],
    exports: [ExecutionsService],
})
export class ExecutionsModule { }
