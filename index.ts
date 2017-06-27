import 'reflect-metadata';
import * as Path from 'path';
import {
    ClassLoader,
    ClassLoaderOptions,
    ClassConstructor,
    FileInfo,
    FileType,
    ModuleInfo,
    InstanceInfo,
    RecursiveFilterFilesOptions
} from '@jstype/loader';

export {
    ClassConstructor,
    FileInfo,
    FileType,
    ModuleInfo,
    InstanceInfo,
    RecursiveFilterFilesOptions
};

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
    path?: string;
}

function createDecorator(method: string, path?: string): MethodDecorator {
    return (target: object, name: string) => {
        let actions: Action[] = Reflect.getMetadata(ACTIONS, target);
        if (!actions) {
            actions = [];
            Reflect.defineMetadata(ACTIONS, actions, target);
        }
        actions.push({ name, method, path });
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

export interface ControllerDecoratorOptions {
    [key: string]: any;
    prefix?: string;
}

export function Controller(opts?: ControllerDecoratorOptions): ClassDecorator {
    return (target: ClassConstructor) => {
        defineController(target, opts);
    };
}

export function defineActions(Class: ClassConstructor, actions: Action[]) {
    Reflect.defineMetadata(ACTIONS, actions, Class.prototype);
}

export function defineController(Class: ClassConstructor, opts?: ControllerDecoratorOptions) {
    Reflect.defineMetadata(CONTROLLER, opts || {}, Class);
}

export type CollectFn = (controller: any, action: Action, middleware: any[]) => boolean;

export interface EnsurePathOptions {
    action: Action;
    file: FileInfo;
    className: string;
    ctrlOpts: ControllerDecoratorOptions;
}

export interface RegisterRouteOptions {
    action: Action;
    path: string;
    middleware: any[];
    controllerName: string;
    ctrlOpts: ControllerDecoratorOptions;
}

export interface ControllerInstanceInfo extends InstanceInfo {
    className: string;
    ctrlOpts: ControllerDecoratorOptions;
    actions: Action[];
}

export interface LoaderOptions extends ClassLoaderOptions {
    requireControllerDecorator?: boolean;
    filterActions?: (actions: Action[], controller: any) => Action[];

    processAction?: (action: Action, info: ControllerInstanceInfo) => void;
    normalizeMiddleware?: (middleware: any[]) => Function[];
    ensurePath?: (opts: EnsurePathOptions) => string;

    router?: any;
    registerRoute?: (opts: RegisterRouteOptions) => void;
}

export default class Loader extends ClassLoader {
    protected middlewareCollectors: CollectFn[] = [];

    requireControllerDecorator: boolean;
    router: any;

    constructor(opts?: LoaderOptions) {
        super(opts);

        this.override([
            'requireControllerDecorator',
            'router',
            'filterActions',
            'processAction',
            'normalizeMiddleware',
            'ensurePath',
            'registerRoute'
        ], opts);
    }

    addMiddlewareCollector(collect: CollectFn) {
        this.middlewareCollectors.push(collect);
        return this;
    }

    protected processClass(Class: ClassConstructor, moduleInfo: ModuleInfo): ControllerInstanceInfo | null {
        let className = Class.name;

        let ctrlOpts: ControllerDecoratorOptions = Reflect.getMetadata(CONTROLLER, Class);
        if (!ctrlOpts) {
            if (this.requireControllerDecorator) {
                return null;
            }
            ctrlOpts = {};
        }

        let controller = this.instantiate(Class);
        if (!controller) {
            return null;
        }

        let actions: Action[] = Reflect.getMetadata(ACTIONS, controller);
        if (!actions) {
            return null;
        }

        actions = this.filterActions(actions, controller);

        return {
            file: moduleInfo.file,
            Class,
            className,
            instance: controller,
            ctrlOpts,
            actions
        };
    }

    protected filterActions(actions: Action[], _controller: any) {
        return actions;
    }

    protected processInstance(info: ControllerInstanceInfo) {
        info.actions.forEach(action => this.processAction(action, info));
        return info;
    }

    protected processAction(action: Action, info: ControllerInstanceInfo) {
        let middleware: any[] = [];

        for (let collect of this.middlewareCollectors) {
            if (!collect(info.instance, action, middleware)) {
                return;
            }
        }

        middleware = this.normalizeMiddleware(middleware);

        let handler = info.instance[action.name].bind(info.instance);
        middleware.push(handler);

        let path = this.ensurePath({
            action,
            file: info.file,
            className: info.className,
            ctrlOpts: info.ctrlOpts
        });

        this.registerRoute({
            action,
            path,
            middleware,
            controllerName: info.className,
            ctrlOpts: info.ctrlOpts
        });
    }

    protected normalizeMiddleware(middleware: any[]): Function[] {
        return middleware;
    }

    protected ensurePath({ action, file, ctrlOpts }: EnsurePathOptions): string {
        if (action.path) {
            if (ctrlOpts.prefix) {
                return Path.join(ctrlOpts.prefix, action.path);
            } else {
                return action.path;
            }
        }

        return Path.join('/', file.dirname, file.basename, action.name);
    }

    protected registerRoute({ action, path, middleware }: RegisterRouteOptions) {
        this.router[action.method.toLowerCase()](path, ...middleware);
        console.log(`Register Route "${action.method} ${path}"`);
    }
}
