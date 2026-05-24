declare module "bootstrap/dist/js/bootstrap.bundle.min.js";

declare module "bootstrap" {
  export class Modal {
    constructor(element: Element);
    static getOrCreateInstance(element: Element): Modal;
    static getInstance(element: Element): Modal | null;
    show(): void;
    hide(): void;
  }
}
