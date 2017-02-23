import * as fs from 'fs';
import * as Path from 'path';

export const CONTROLLER = Symbol.for('@jstype/route-loader/controller');
export const ACTIONS = Symbol.for('@jstype/route-loader/actions');

export declare function GET(path?: string): MethodDecorator;
export declare function POST(path?: string): MethodDecorator;
export declare function PUT(path?: string): MethodDecorator;
export declare function DELETE(path?: string): MethodDecorator;
export declare function HEAD(path?: string): MethodDecorator;
export declare function PATCH(path?: string): MethodDecorator;
export declare function OPTIONS(path?: string): MethodDecorator;

export interface Action {
    /** property name */
    name: string;
    /** HTTP method */
    method: string;
    path: string;
}

function createDecorator(method: string, path?: string) {
    return (target: object, name: string) => {
        if (!(<any>target)[ACTIONS]) {
            (<any>target)[ACTIONS] = [{ name, method, path }];
        } else {
            (<any>target)[ACTIONS].push({ name, method, path });
        }
    };
}

['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS'].forEach(method => {
    exports[method] = (path?: string) => {
        return createDecorator(method, path);
    };
});

export function HTTP(method: string, path?: string) {
    method = method.toUpperCase();
    return createDecorator(method, path);
}

export interface ControllerConstructor extends Function {
    new (...args: any[]): any;
}

export interface ControllerDecoratorOptions {
    [key: string]: any;
    prefix?: string;
}

export function Controller(opts?: ControllerDecoratorOptions): ClassDecorator {
    return (target: ControllerConstructor) => {
        (<any>target)[CONTROLLER] = opts || {};
    };
}

export type FileFilterFn = (absolutePath: string, dirname: string, basename: string) => boolean;

export interface FileInfo {
    absolutePath: string;
    dirname: string;
    basename: string;
}

export type CollectFn = (controller: any, action: Action, middleware: any[]) => boolean;

export interface EnsurePathOptions {
    action: Action;
    file: FileInfo;
    controllerName: string;
    ctrlOpts: ControllerDecoratorOptions;
}

export interface RegisterRouteOptions {
    router: any;
    action: Action;
    path: string;
    middleware: any[];
    controllerName: string;
    ctrlOpts: ControllerDecoratorOptions;
}

export interface ControllerInfo {
    controllerName: string;
    ctrlOpts: ControllerDecoratorOptions;
    controller: any;
    actions: Action[];
}

export interface ProcessActionOptions {
    controller: any;
    action: Action;
    controllerName: string;
    ctrlOpts: ControllerDecoratorOptions;
    file: FileInfo;
}

export interface LoaderOptions {
    ext?: string;
    fileFilter?: RegExp | FileFilterFn;
    getFiles?: (path: string, fileFilter: FileFilterFn, ext: string) => FileInfo[];

    processFile?: (this: Loader, file: FileInfo) => ControllerInfo;
    requireControllerDecorator?: boolean;
    controllerOpts?: any;
    getControllerClass?: (file: FileInfo) => ControllerConstructor;
    newController?: (Controller: ControllerConstructor, opts: any) => any;
    filterActions?: (actions: Action[], controller: any) => Action[];

    processAction?: (this: Loader, opts: ProcessActionOptions) => void;
    router?: any;
    normalizeMiddleware?: (middleware: any[]) => Function[];
    ensurePath?: (opts: EnsurePathOptions) => string;
    registerRoute?: (opts: RegisterRouteOptions) => void;
}

export class Loader {
    middlewareCollectors: CollectFn[];

    ext: string;
    fileFilter: RegExp | FileFilterFn;
    getFiles: (path: string, fileFilter: FileFilterFn, ext: string) => FileInfo[];

    processFile: (this: Loader, file: FileInfo) => ControllerInfo;
    requireControllerDecorator: boolean;
    controllerOpts?: any;
    getControllerClass: (file: FileInfo) => ControllerConstructor;
    newController: (Controller: ControllerConstructor, opts: any) => any;
    filterActions?: (actions: Action[], controller: any) => Action[];

    processAction: (this: Loader, opts: ProcessActionOptions) => void;
    router: any;
    normalizeMiddleware?: (middleware: any[]) => Function[];
    ensurePath: (opts: EnsurePathOptions) => string;
    registerRoute: (opts: RegisterRouteOptions) => void;

    constructor(opts?: LoaderOptions) {
        opts = opts || {};

        this.ext = opts.ext || '.js';
        this.fileFilter = opts.fileFilter || /.*\.js$/;
        this.getFiles = opts.getFiles || defaultGetFiles;

        this.processFile = (opts.processFile || defaultProcessFile).bind(this);
        this.requireControllerDecorator = !!opts.requireControllerDecorator;
        this.controllerOpts = opts.controllerOpts;
        this.getControllerClass = opts.getControllerClass || defaultGetControllerClass;
        this.newController = opts.newController || defaultNewController;
        this.filterActions = opts.filterActions;

        this.processAction = (opts.processAction || defaultProcessAction).bind(this);
        this.router = opts.router;
        this.normalizeMiddleware = opts.normalizeMiddleware;
        this.ensurePath = opts.ensurePath || defaultEnsurePath;
        this.registerRoute = opts.registerRoute || defaultRegisterRoute;
    }

    addMiddlewareCollector(collect: CollectFn) {
        this.middlewareCollectors.push(collect);
        return this;
    }

    load(path: string) {
        let fileFilter = this.fileFilter as FileFilterFn;
        if (typeof fileFilter != 'function') {
            fileFilter = (<RegExp>fileFilter).test.bind(fileFilter);
        }
        let files = this.getFiles(path, fileFilter, this.ext);
        files.forEach(file => this.loadController(file));
    }

    loadController(file: FileInfo) {
        let {
            controllerName,
            ctrlOpts,
            controller,
            actions
        } = this.processFile(file);

        actions.forEach(action => this.processAction({ controller, action, controllerName, ctrlOpts, file }));
    }
}

function defaultGetFiles(path: string, fileFilter: FileFilterFn, ext: string) {
    let files: FileInfo[] = [];
    recursiveFilterFiles(path, fileFilter, files, ext);
    return files;
}

function defaultProcessFile(this: Loader, file: FileInfo): ControllerInfo {
    let Controller = this.getControllerClass(file);
    let controllerName = Controller.name;

    let ctrlOpts: ControllerDecoratorOptions = (<any>Controller)[CONTROLLER];
    if (!ctrlOpts) {
        if (this.requireControllerDecorator) {
            return;
        }
        ctrlOpts = {};
    }

    let controller = this.newController(Controller, this.controllerOpts);
    if (!controller) {
        return;
    }

    let actions: Action[] = controller[ACTIONS];
    if (!actions) {
        return;
    }

    if (this.filterActions) {
        actions = this.filterActions(actions, controller);
    }

    return {
        controllerName,
        ctrlOpts,
        controller,
        actions
    };
}

function defaultProcessAction(this: Loader, { controller, action, controllerName, ctrlOpts, file }: ProcessActionOptions) {
    let middleware: any[] = [];

    for (let collect of this.middlewareCollectors) {
        if (!collect(controller, action, middleware)) {
            return;
        }
    }

    if (this.normalizeMiddleware) {
        middleware = this.normalizeMiddleware(middleware);
    }

    let handler = controller[action.name].bind(controller);
    middleware.push(handler);

    let path = this.ensurePath({
        action,
        file,
        controllerName,
        ctrlOpts
    });

    this.registerRoute({
        router: this.router,
        action,
        path,
        middleware,
        controllerName,
        ctrlOpts
    });
}

function defaultGetControllerClass(file: FileInfo) {
    return require(file.absolutePath).default;
}

function defaultNewController(Controller: ControllerConstructor, opts: any) {
    return new Controller(opts);
}

function defaultEnsurePath({ action, file, ctrlOpts }: EnsurePathOptions) {
    if (action.path) {
        if (ctrlOpts.prefix) {
            return Path.join(ctrlOpts.prefix, action.path);
        } else {
            return action.path;
        }
    }

    return Path.join('/', file.dirname, file.basename, action.name);
}

function defaultRegisterRoute({ router, action, path, middleware }: RegisterRouteOptions) {
    router[action.method.toLowerCase()](path, ...middleware);
    console.log(`Register Route "${action.method} ${path}"`);
}

function recursiveFilterFiles(path: string, filter: FileFilterFn, files: FileInfo[], ext: string, basePath?: string) {
    if (!Path.isAbsolute(path)) {
        path = Path.resolve(path);
    }
    basePath = basePath || path;

    let dirs: string[] = [];
    let list = fs.readdirSync(path);

    list.forEach(name => {
        let absolutePath = Path.join(path, name);
        let stat = fs.statSync(absolutePath);

        if (stat.isFile()) {
            let dirname = Path.dirname(Path.relative(basePath, path));
            let basename = Path.basename(path, ext);
            if (filter(absolutePath, dirname, basename)) {
                files.push({ absolutePath, dirname, basename });
            }
        } else if (stat.isDirectory()) {
            dirs.push(absolutePath);
        }
    });

    dirs.forEach(dir => recursiveFilterFiles(dir, filter, files, ext, basePath));
}
