var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ElementAst, BoundDirectivePropertyAst, DirectiveAst } from 'angular2/compiler';
import { AstTransformer, LiteralArray, LiteralPrimitive } from 'angular2/src/compiler/expression_parser/ast';
import { BaseException } from 'angular2/src/facade/exceptions';
import { Injectable } from 'angular2/core';
import { Parser } from 'angular2/src/compiler/expression_parser/parser';
/**
 * e.g., './User', 'Modal' in ./User[Modal(param: value)]
 */
class FixedPart {
    constructor(value) {
        this.value = value;
    }
}
/**
 * The square bracket
 */
class AuxiliaryStart {
    constructor() {
    }
}
/**
 * The square bracket
 */
class AuxiliaryEnd {
    constructor() {
    }
}
/**
 * e.g., param:value in ./User[Modal(param: value)]
 */
class Params {
    constructor(ast) {
        this.ast = ast;
    }
}
class RouterLinkLexer {
    constructor(parser, exp) {
        this.parser = parser;
        this.exp = exp;
        this.index = 0;
    }
    tokenize() {
        let tokens = [];
        while (this.index < this.exp.length) {
            tokens.push(this._parseToken());
        }
        return tokens;
    }
    _parseToken() {
        let c = this.exp[this.index];
        if (c == '[') {
            this.index++;
            return new AuxiliaryStart();
        }
        else if (c == ']') {
            this.index++;
            return new AuxiliaryEnd();
        }
        else if (c == '(') {
            return this._parseParams();
        }
        else if (c == '/' && this.index !== 0) {
            this.index++;
            return this._parseFixedPart();
        }
        else {
            return this._parseFixedPart();
        }
    }
    _parseParams() {
        let start = this.index;
        for (; this.index < this.exp.length; ++this.index) {
            let c = this.exp[this.index];
            if (c == ')') {
                let paramsContent = this.exp.substring(start + 1, this.index);
                this.index++;
                return new Params(this.parser.parseBinding(`{${paramsContent}}`, null).ast);
            }
        }
        throw new BaseException("Cannot find ')'");
    }
    _parseFixedPart() {
        let start = this.index;
        let sawNonSlash = false;
        for (; this.index < this.exp.length; ++this.index) {
            let c = this.exp[this.index];
            if (c == '(' || c == '[' || c == ']' || (c == '/' && sawNonSlash)) {
                break;
            }
            if (c != '.' && c != '/') {
                sawNonSlash = true;
            }
        }
        let fixed = this.exp.substring(start, this.index);
        if (start === this.index || !sawNonSlash || fixed.startsWith('//')) {
            throw new BaseException("Invalid router link");
        }
        return new FixedPart(fixed);
    }
}
class RouterLinkAstGenerator {
    constructor(tokens) {
        this.tokens = tokens;
        this.index = 0;
    }
    generate() { return this._genAuxiliary(); }
    _genAuxiliary() {
        let arr = [];
        for (; this.index < this.tokens.length; this.index++) {
            let r = this.tokens[this.index];
            if (r instanceof FixedPart) {
                arr.push(new LiteralPrimitive(r.value));
            }
            else if (r instanceof Params) {
                arr.push(r.ast);
            }
            else if (r instanceof AuxiliaryEnd) {
                break;
            }
            else if (r instanceof AuxiliaryStart) {
                this.index++;
                arr.push(this._genAuxiliary());
            }
        }
        return new LiteralArray(arr);
    }
}
class RouterLinkAstTransformer extends AstTransformer {
    constructor(parser) {
        super();
        this.parser = parser;
    }
    visitQuote(ast, context) {
        if (ast.prefix == "route") {
            return parseRouterLinkExpression(this.parser, ast.uninterpretedExpression);
        }
        else {
            return super.visitQuote(ast, context);
        }
    }
}
export function parseRouterLinkExpression(parser, exp) {
    let tokens = new RouterLinkLexer(parser, exp.trim()).tokenize();
    return new RouterLinkAstGenerator(tokens).generate();
}
/**
 * A compiler plugin that implements the router link DSL.
 */
export let RouterLinkTransform = class RouterLinkTransform {
    constructor(parser) {
        this.astTransformer = new RouterLinkAstTransformer(parser);
    }
    visitNgContent(ast, context) { return ast; }
    visitEmbeddedTemplate(ast, context) { return ast; }
    visitElement(ast, context) {
        let updatedChildren = ast.children.map(c => c.visit(this, context));
        let updatedInputs = ast.inputs.map(c => c.visit(this, context));
        let updatedDirectives = ast.directives.map(c => c.visit(this, context));
        return new ElementAst(ast.name, ast.attrs, updatedInputs, ast.outputs, ast.references, updatedDirectives, ast.providers, ast.hasViewContainer, updatedChildren, ast.ngContentIndex, ast.sourceSpan);
    }
    visitReference(ast, context) { return ast; }
    visitVariable(ast, context) { return ast; }
    visitEvent(ast, context) { return ast; }
    visitElementProperty(ast, context) { return ast; }
    visitAttr(ast, context) { return ast; }
    visitBoundText(ast, context) { return ast; }
    visitText(ast, context) { return ast; }
    visitDirective(ast, context) {
        let updatedInputs = ast.inputs.map(c => c.visit(this, context));
        return new DirectiveAst(ast.directive, updatedInputs, ast.hostProperties, ast.hostEvents, ast.sourceSpan);
    }
    visitDirectiveProperty(ast, context) {
        let transformedValue = ast.value.visit(this.astTransformer);
        return new BoundDirectivePropertyAst(ast.directiveName, ast.templateName, transformedValue, ast.sourceSpan);
    }
};
RouterLinkTransform = __decorate([
    Injectable(), 
    __metadata('design:paramtypes', [Parser])
], RouterLinkTransform);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyX2xpbmtfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC13WEVJMzdmUi50bXAvYW5ndWxhcjIvc3JjL3JvdXRlci9kaXJlY3RpdmVzL3JvdXRlcl9saW5rX3RyYW5zZm9ybS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7T0FBTyxFQUVMLFVBQVUsRUFDVix5QkFBeUIsRUFDekIsWUFBWSxFQUViLE1BQU0sbUJBQW1CO09BQ25CLEVBQ0wsY0FBYyxFQUlkLFlBQVksRUFDWixnQkFBZ0IsRUFFakIsTUFBTSw2Q0FBNkM7T0FDN0MsRUFBQyxhQUFhLEVBQUMsTUFBTSxnQ0FBZ0M7T0FDckQsRUFBQyxVQUFVLEVBQUMsTUFBTSxlQUFlO09BQ2pDLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0RBQWdEO0FBRXJFOztHQUVHO0FBQ0g7SUFDRSxZQUFtQixLQUFhO1FBQWIsVUFBSyxHQUFMLEtBQUssQ0FBUTtJQUFHLENBQUM7QUFDdEMsQ0FBQztBQUVEOztHQUVHO0FBQ0g7SUFDRTtJQUFlLENBQUM7QUFDbEIsQ0FBQztBQUVEOztHQUVHO0FBQ0g7SUFDRTtJQUFlLENBQUM7QUFDbEIsQ0FBQztBQUVEOztHQUVHO0FBQ0g7SUFDRSxZQUFtQixHQUFRO1FBQVIsUUFBRyxHQUFILEdBQUcsQ0FBSztJQUFHLENBQUM7QUFDakMsQ0FBQztBQUVEO0lBR0UsWUFBb0IsTUFBYyxFQUFVLEdBQVc7UUFBbkMsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUFVLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFGdkQsVUFBSyxHQUFXLENBQUMsQ0FBQztJQUV3QyxDQUFDO0lBRTNELFFBQVE7UUFDTixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDaEIsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDcEMsTUFBTSxD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QUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM1RCxNQUFNLENBQUMsSUFBSSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLEVBQ3JELEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN2RCxDQUFDO0FBQ0gsQ0FBQztBQTVDRDtJQUFDLFVBQVUsRUFBRTs7dUJBQUE7QUE0Q1oiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBUZW1wbGF0ZUFzdFZpc2l0b3IsXG4gIEVsZW1lbnRBc3QsXG4gIEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsXG4gIERpcmVjdGl2ZUFzdCxcbiAgQm91bmRFbGVtZW50UHJvcGVydHlBc3Rcbn0gZnJvbSAnYW5ndWxhcjIvY29tcGlsZXInO1xuaW1wb3J0IHtcbiAgQXN0VHJhbnNmb3JtZXIsXG4gIFF1b3RlLFxuICBBU1QsXG4gIEVtcHR5RXhwcixcbiAgTGl0ZXJhbEFycmF5LFxuICBMaXRlcmFsUHJpbWl0aXZlLFxuICBBU1RXaXRoU291cmNlXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb21waWxlci9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtCYXNlRXhjZXB0aW9ufSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2V4Y2VwdGlvbnMnO1xuaW1wb3J0IHtJbmplY3RhYmxlfSBmcm9tICdhbmd1bGFyMi9jb3JlJztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICdhbmd1bGFyMi9zcmMvY29tcGlsZXIvZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcblxuLyoqXG4gKiBlLmcuLCAnLi9Vc2VyJywgJ01vZGFsJyBpbiAuL1VzZXJbTW9kYWwocGFyYW06IHZhbHVlKV1cbiAqL1xuY2xhc3MgRml4ZWRQYXJ0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcpIHt9XG59XG5cbi8qKlxuICogVGhlIHNxdWFyZSBicmFja2V0XG4gKi9cbmNsYXNzIEF1eGlsaWFyeVN0YXJ0IHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG4vKipcbiAqIFRoZSBzcXVhcmUgYnJhY2tldFxuICovXG5jbGFzcyBBdXhpbGlhcnlFbmQge1xuICBjb25zdHJ1Y3RvcigpIHt9XG59XG5cbi8qKlxuICogZS5nLiwgcGFyYW06dmFsdWUgaW4gLi9Vc2VyW01vZGFsKHBhcmFtOiB2YWx1ZSldXG4gKi9cbmNsYXNzIFBhcmFtcyB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBhc3Q6IEFTVCkge31cbn1cblxuY2xhc3MgUm91dGVyTGlua0xleGVyIHtcbiAgaW5kZXg6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYXJzZXI6IFBhcnNlciwgcHJpdmF0ZSBleHA6IHN0cmluZykge31cblxuICB0b2tlbml6ZSgpOiBBcnJheTxGaXhlZFBhcnQgfCBBdXhpbGlhcnlTdGFydCB8IEF1eGlsaWFyeUVuZCB8IFBhcmFtcz4ge1xuICAgIGxldCB0b2tlbnMgPSBbXTtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMuZXhwLmxlbmd0aCkge1xuICAgICAgdG9rZW5zLnB1c2godGhpcy5fcGFyc2VUb2tlbigpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRva2VucztcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlVG9rZW4oKSB7XG4gICAgbGV0IGMgPSB0aGlzLmV4cFt0aGlzLmluZGV4XTtcbiAgICBpZiAoYyA9PSAnWycpIHtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiBuZXcgQXV4aWxpYXJ5U3RhcnQoKTtcblxuICAgIH0gZWxzZSBpZiAoYyA9PSAnXScpIHtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiBuZXcgQXV4aWxpYXJ5RW5kKCk7XG5cbiAgICB9IGVsc2UgaWYgKGMgPT0gJygnKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyc2VQYXJhbXMoKTtcblxuICAgIH0gZWxzZSBpZiAoYyA9PSAnLycgJiYgdGhpcy5pbmRleCAhPT0gMCkge1xuICAgICAgdGhpcy5pbmRleCsrO1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlRml4ZWRQYXJ0KCk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlRml4ZWRQYXJ0KCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VQYXJhbXMoKSB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5pbmRleDtcbiAgICBmb3IgKDsgdGhpcy5pbmRleCA8IHRoaXMuZXhwLmxlbmd0aDsgKyt0aGlzLmluZGV4KSB7XG4gICAgICBsZXQgYyA9IHRoaXMuZXhwW3RoaXMuaW5kZXhdO1xuICAgICAgaWYgKGMgPT0gJyknKSB7XG4gICAgICAgIGxldCBwYXJhbXNDb250ZW50ID0gdGhpcy5leHAuc3Vic3RyaW5nKHN0YXJ0ICsgMSwgdGhpcy5pbmRleCk7XG4gICAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgICAgcmV0dXJuIG5ldyBQYXJhbXModGhpcy5wYXJzZXIucGFyc2VCaW5kaW5nKGB7JHtwYXJhbXNDb250ZW50fX1gLCBudWxsKS5hc3QpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgQmFzZUV4Y2VwdGlvbihcIkNhbm5vdCBmaW5kICcpJ1wiKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlRml4ZWRQYXJ0KCkge1xuICAgIGxldCBzdGFydCA9IHRoaXMuaW5kZXg7XG4gICAgbGV0IHNhd05vblNsYXNoID0gZmFsc2U7XG5cblxuICAgIGZvciAoOyB0aGlzLmluZGV4IDwgdGhpcy5leHAubGVuZ3RoOyArK3RoaXMuaW5kZXgpIHtcbiAgICAgIGxldCBjID0gdGhpcy5leHBbdGhpcy5pbmRleF07XG5cbiAgICAgIGlmIChjID09ICcoJyB8fCBjID09ICdbJyB8fCBjID09ICddJyB8fCAoYyA9PSAnLycgJiYgc2F3Tm9uU2xhc2gpKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYyAhPSAnLicgJiYgYyAhPSAnLycpIHtcbiAgICAgICAgc2F3Tm9uU2xhc2ggPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBmaXhlZCA9IHRoaXMuZXhwLnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG5cbiAgICBpZiAoc3RhcnQgPT09IHRoaXMuaW5kZXggfHwgIXNhd05vblNsYXNoIHx8IGZpeGVkLnN0YXJ0c1dpdGgoJy8vJykpIHtcbiAgICAgIHRocm93IG5ldyBCYXNlRXhjZXB0aW9uKFwiSW52YWxpZCByb3V0ZXIgbGlua1wiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEZpeGVkUGFydChmaXhlZCk7XG4gIH1cbn1cblxuY2xhc3MgUm91dGVyTGlua0FzdEdlbmVyYXRvciB7XG4gIGluZGV4OiBudW1iZXIgPSAwO1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRva2VuczogYW55W10pIHt9XG5cbiAgZ2VuZXJhdGUoKTogQVNUIHsgcmV0dXJuIHRoaXMuX2dlbkF1eGlsaWFyeSgpOyB9XG5cbiAgcHJpdmF0ZSBfZ2VuQXV4aWxpYXJ5KCk6IEFTVCB7XG4gICAgbGV0IGFyciA9IFtdO1xuICAgIGZvciAoOyB0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoOyB0aGlzLmluZGV4KyspIHtcbiAgICAgIGxldCByID0gdGhpcy50b2tlbnNbdGhpcy5pbmRleF07XG5cbiAgICAgIGlmIChyIGluc3RhbmNlb2YgRml4ZWRQYXJ0KSB7XG4gICAgICAgIGFyci5wdXNoKG5ldyBMaXRlcmFsUHJpbWl0aXZlKHIudmFsdWUpKTtcblxuICAgICAgfSBlbHNlIGlmIChyIGluc3RhbmNlb2YgUGFyYW1zKSB7XG4gICAgICAgIGFyci5wdXNoKHIuYXN0KTtcblxuICAgICAgfSBlbHNlIGlmIChyIGluc3RhbmNlb2YgQXV4aWxpYXJ5RW5kKSB7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICB9IGVsc2UgaWYgKHIgaW5zdGFuY2VvZiBBdXhpbGlhcnlTdGFydCkge1xuICAgICAgICB0aGlzLmluZGV4Kys7XG4gICAgICAgIGFyci5wdXNoKHRoaXMuX2dlbkF1eGlsaWFyeSgpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheShhcnIpO1xuICB9XG59XG5cbmNsYXNzIFJvdXRlckxpbmtBc3RUcmFuc2Zvcm1lciBleHRlbmRzIEFzdFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYXJzZXI6IFBhcnNlcikgeyBzdXBlcigpOyB9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIGlmIChhc3QucHJlZml4ID09IFwicm91dGVcIikge1xuICAgICAgcmV0dXJuIHBhcnNlUm91dGVyTGlua0V4cHJlc3Npb24odGhpcy5wYXJzZXIsIGFzdC51bmludGVycHJldGVkRXhwcmVzc2lvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdXBlci52aXNpdFF1b3RlKGFzdCwgY29udGV4dCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJvdXRlckxpbmtFeHByZXNzaW9uKHBhcnNlcjogUGFyc2VyLCBleHA6IHN0cmluZyk6IEFTVCB7XG4gIGxldCB0b2tlbnMgPSBuZXcgUm91dGVyTGlua0xleGVyKHBhcnNlciwgZXhwLnRyaW0oKSkudG9rZW5pemUoKTtcbiAgcmV0dXJuIG5ldyBSb3V0ZXJMaW5rQXN0R2VuZXJhdG9yKHRva2VucykuZ2VuZXJhdGUoKTtcbn1cblxuLyoqXG4gKiBBIGNvbXBpbGVyIHBsdWdpbiB0aGF0IGltcGxlbWVudHMgdGhlIHJvdXRlciBsaW5rIERTTC5cbiAqL1xuQEluamVjdGFibGUoKVxuZXhwb3J0IGNsYXNzIFJvdXRlckxpbmtUcmFuc2Zvcm0gaW1wbGVtZW50cyBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICBwcml2YXRlIGFzdFRyYW5zZm9ybWVyO1xuXG4gIGNvbnN0cnVjdG9yKHBhcnNlcjogUGFyc2VyKSB7IHRoaXMuYXN0VHJhbnNmb3JtZXIgPSBuZXcgUm91dGVyTGlua0FzdFRyYW5zZm9ybWVyKHBhcnNlcik7IH1cblxuICB2aXNpdE5nQ29udGVudChhc3Q6IGFueSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IGFueSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgbGV0IHVwZGF0ZWRDaGlsZHJlbiA9IGFzdC5jaGlsZHJlbi5tYXAoYyA9PiBjLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICBsZXQgdXBkYXRlZElucHV0cyA9IGFzdC5pbnB1dHMubWFwKGMgPT4gYy52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgbGV0IHVwZGF0ZWREaXJlY3RpdmVzID0gYXN0LmRpcmVjdGl2ZXMubWFwKGMgPT4gYy52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBFbGVtZW50QXN0KGFzdC5uYW1lLCBhc3QuYXR0cnMsIHVwZGF0ZWRJbnB1dHMsIGFzdC5vdXRwdXRzLCBhc3QucmVmZXJlbmNlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZERpcmVjdGl2ZXMsIGFzdC5wcm92aWRlcnMsIGFzdC5oYXNWaWV3Q29udGFpbmVyLCB1cGRhdGVkQ2hpbGRyZW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5uZ0NvbnRlbnRJbmRleCwgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UoYXN0OiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhc3Q7IH1cblxuICB2aXNpdFZhcmlhYmxlKGFzdDogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRFdmVudChhc3Q6IGFueSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGFzdDsgfVxuXG4gIHZpc2l0RWxlbWVudFByb3BlcnR5KGFzdDogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRBdHRyKGFzdDogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRCb3VuZFRleHQoYXN0OiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhc3Q7IH1cblxuICB2aXNpdFRleHQoYXN0OiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhc3Q7IH1cblxuICB2aXNpdERpcmVjdGl2ZShhc3Q6IERpcmVjdGl2ZUFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgdXBkYXRlZElucHV0cyA9IGFzdC5pbnB1dHMubWFwKGMgPT4gYy52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBEaXJlY3RpdmVBc3QoYXN0LmRpcmVjdGl2ZSwgdXBkYXRlZElucHV0cywgYXN0Lmhvc3RQcm9wZXJ0aWVzLCBhc3QuaG9zdEV2ZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3Quc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdERpcmVjdGl2ZVByb3BlcnR5KGFzdDogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgdHJhbnNmb3JtZWRWYWx1ZSA9IGFzdC52YWx1ZS52aXNpdCh0aGlzLmFzdFRyYW5zZm9ybWVyKTtcbiAgICByZXR1cm4gbmV3IEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QoYXN0LmRpcmVjdGl2ZU5hbWUsIGFzdC50ZW1wbGF0ZU5hbWUsIHRyYW5zZm9ybWVkVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5zb3VyY2VTcGFuKTtcbiAgfVxufSJdfQ==