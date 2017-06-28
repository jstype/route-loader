import { GET, PATCH, HTTP, Controller } from '../..';
import { Context } from 'koa';

@Controller()
export default class User {
    @GET('/user/info')
    info(ctx: Context) {
        ctx.body = 'jKey Lu';
    }

    @PATCH('/user/info')
    updateInfo(ctx: Context) {
        ctx.body = 'Updated';
    }
}
