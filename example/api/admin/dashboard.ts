import { GET, POST, HTTP, Controller } from '../../..';
import { Context } from 'koa';

@Controller()
export default class Dashboard {
    @GET('/admin/dashboard')
    index(ctx: Context) {
        ctx.body = 'Hello, it is dashboard';
    }
}