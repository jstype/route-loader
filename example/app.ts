import * as Koa from 'koa';
import Loader from '../';
import { Router } from 'koa-radix-router';

const app = new Koa();
const router: any = new Router();

const loader = new Loader({
    cwd: __dirname,
    router,
    fileFilter: /.*\.ts$/i
});
loader.load('./api');

app.use(router.routes());
app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
