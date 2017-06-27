import { GET, POST, HTTP, Controller } from '../..';
import { Context } from 'koa';

@Controller()
export default class User {
    @GET('/user/info')
    info(ctx: Context) {
        ctx.body = 'jKey Lu';
    }
}