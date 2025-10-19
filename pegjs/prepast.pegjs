{
function addPositionInfo(r){
    var posDetails = peg$computePosDetails(peg$currPos);
    r.eLine = posDetails.line;
    r.eColumn = posDetails.column;
    r.eOffset = peg$currPos;
    posDetails = peg$computePosDetails(peg$savedPos);
    r.sLine = posDetails.line;
    r.sColumn = posDetails.column;
    r.sOffset = peg$savedPos;
    return r;
}

function handleConstant(input, r) {
    if (r.eOffset == null) {
        return r;
    }
    return input.substring(r.sOffset, r.eOffset);
}
}

//-------------------------------------------------------------------------
//  A.2.4  External definitions
//-------------------------------------------------------------------------

TranslationUnit
    = Spacing a:(Preprocessor / a:PrepMacroText b:Spacing{
        return addPositionInfo({type:'Code', val:a, space:b})
        })+ EOT {
        return addPositionInfo({type:'TranslationUnit', lines: a});
    };

//-------------------------------------------------------------------------
//  ?.?.?  Preprocessors
//-------------------------------------------------------------------------

Preprocessor = a:(PrepDefine / PrepInclude / ConditionalInclusion) b:Spacing {a.space = b;return a;};

PrepDefine = PrepFunctionMacro / PrepSimpleMacro / PrepUndef;

PrepUndef = SHARP UNDEF a:Identifier {return addPositionInfo({type:'PrepUndef', Identifier:a});};

PrepSimpleMacro = SHARP DEFINE a:Identifier b:PrepMacroText? {
    return addPositionInfo({type:'PrepSimpleMacro', Identifier:a, Replacement:b});
};

PrepFunctionMacro = SHARP DEFINE a:Identifier b:PrepFunctionMacroArgs c:PrepMacroText {
    return addPositionInfo({type:'PrepFunctionMacro', Identifier:a, Args:b, Replacement:c});
};

PrepFunctionMacroArgs = LPAR a:Identifier b:(COMMA a1:Identifier {return a1;})* RPAR {
    return [a].concat(b);
};

PrepFunctionMacroCallArgs = LPAR a:PrepMacroMacroCallText b:(COMMA a1:PrepMacroMacroCallText {return a1;})* RPAR {
    return [a].concat(b);
};

PrepMacroMacroCallText = a:(a:Identifier b:PrepFunctionMacroCallArgs c:InlineSpacing{
    return {type:'PrepFunctionMacroCall', Identifier:a, Args:b, space:c};
    } / Identifier / StringLiteral / SeperatorArgs)+ {
    var ret = [];
    var lastString = null;
    for (var i=0;i<a.length;i++){
        if (a[i].type==='Seperator'){
            if (lastString===null){
                lastString = a[i];
            }else{
                lastString.val += lastString.space + a[i].val;
                lastString.space = a[i].space;
            }
        }else{
            if (lastString!==null){
                ret.push(lastString);
                lastString = null;
            }
            ret.push(a[i]);
        }
    }
    if (lastString!==null)
        ret.push(lastString);
    return ret;
};

PrepMacroText = a:(a:Identifier b:PrepFunctionMacroCallArgs c:InlineSpacing {
    return {type:'PrepFunctionMacroCall', Identifier:a, Args:b, space:c};
    } / Identifier / Seperator)+ {
    var ret = [];
    var lastString = null;
    for (var i=0;i<a.length;i++){
        if (a[i].type==='Seperator'){
            if (lastString===null){
                lastString = a[i];
            }else{
                lastString.val += lastString.space + a[i].val;
                lastString.space = a[i].space;
            }
        }else{
            if (lastString!==null){
                ret.push(lastString);
                lastString = null;
            }
            ret.push(a[i]);
        }
    }
    if (lastString!==null)
        ret.push(lastString);
    return ret;
};

PrepInclude = PrepIncludeLib / PrepIncludeLocal;

PrepIncludeLib = SHARP INCLUDE LT a:Filename GT {
    return addPositionInfo({type:'PrepIncludeLib', name:a});
};

PrepIncludeLocal = SHARP INCLUDE QUO a:Filename QUO {
    return addPositionInfo({type:'PrepIncludeLocal', name:a});
};

Filename = a:(IdChar / [/\\.+])+ {return a.join('');};

ConditionalInclusion = PrepIfdef / PrepIfndef / PrepEndif / PrepElse;

PrepIfdef = SHARP IFDEF a:Identifier {return addPositionInfo({type:'PrepIfdef', Identifier:a});};

PrepIfndef = SHARP IFNDEF a:Identifier {return addPositionInfo({type:'PrepIfndef', Identifier:a});};

PrepEndif = SHARP ENDIF {return addPositionInfo({type:'PrepEndif'});};

PrepElse = SHARP P_ELSE {return addPositionInfo({type:'PrepElse'});};

SHARP = "#" InlineSpacing;
DEFINE = "define" InlineSpacing;
UNDEF = "undef" InlineSpacing;
INCLUDE = "include" InlineSpacing;
IFDEF = "ifdef" InlineSpacing;
IFNDEF = "ifndef" InlineSpacing;
ENDIF = "endif" InlineSpacing;
P_ELSE = "else" InlineSpacing;


//-------------------------------------------------------------------------
//  A.1.1  Lexical elements
//  Tokens are: Keyword, Identifier, Constant, StringLiteral, Punctuator.
//  Tokens are separated by Spacing.
//-------------------------------------------------------------------------

InlineSpacing
    = a:( InlineWhiteSpace
      / LongComment
      / LineComment
      )*{
        return a.join('');
      }

Spacing
    = a:( WhiteSpace
      / LongComment
      / LineComment
      )*{
        return a.join('');
      }
    ;

InlineWhiteSpace = a:[ \t\u000B\u000C] {return a;}; // 7.4.1.10

WhiteSpace  = a:[ \n\r\t\u000B\u000C] {return a;}; // 7.4.1.10

LongComment = "/*" a:(!"*/"_)* "*/" {return '';};   // 6.4.9

LineComment = "//" a:(!"\n" _)*  {return '';};     // 6.4.9


//-------------------------------------------------------------------------
//  A.1.2  Keywords
//-------------------------------------------------------------------------

AUTO      = a:"auto"       !IdChar Spacing {return a;};
BREAK     = a:"break"      !IdChar Spacing {return a;};
CASE      = a:"case"       !IdChar Spacing {return a;};
CHAR      = a:"char"       !IdChar Spacing {return a;};
CONST     = a:"const"      !IdChar Spacing {return a;};
CONTINUE  = a:"continue"   !IdChar Spacing {return a;};
DEFAULT   = a:"default"    !IdChar Spacing {return a;};
DOUBLE    = a:"double"     !IdChar Spacing {return a;};
DO        = a:"do"         !IdChar Spacing {return a;};
ELSE      = a:"else"       !IdChar Spacing {return a;};
ENUM      = a:"enum"       !IdChar Spacing {return a;};
EXTERN    = a:"extern"     !IdChar Spacing {return a;};
FLOAT     = a:"float"      !IdChar Spacing {return a;};
FOR       = a:"for"        !IdChar Spacing {return a;};
GOTO      = a:"goto"       !IdChar Spacing {return a;};
IF        = a:"if"         !IdChar Spacing {return a;};
INT       = a:"int"        !IdChar Spacing {return a;};
INLINE    = a:"inline"     !IdChar Spacing {return a;};
LONG      = a:"long"       !IdChar Spacing {return a;};
REGISTER  = a:"register"   !IdChar Spacing {return a;};
RESTRICT  = a:"restrict"   !IdChar Spacing {return a;};
RETURN    = a:"return"     !IdChar Spacing {return a;};
SHORT     = a:"short"      !IdChar Spacing {return a;};
SIGNED    = a:"signed"     !IdChar Spacing {return a;};
SIZEOF    = a:"sizeof"     !IdChar Spacing {return a;};
STATIC    = a:"static"     !IdChar Spacing {return a;};
STRUCT    = a:"struct"     !IdChar Spacing {return a;};
SWITCH    = a:"switch"     !IdChar Spacing {return a;};
TYPEDEF   = a:"typedef"    !IdChar Spacing {return a;};
UNION     = a:"union"      !IdChar Spacing {return a;};
UNSIGNED  = a:"unsigned"   !IdChar Spacing {return a;};
VOID      = a:"void"       !IdChar Spacing {return a;};
VOLATILE  = a:"volatile"   !IdChar Spacing {return a;};
WHILE     = a:"while"      !IdChar Spacing {return a;};
BOOL      = a:"_Bool"      !IdChar Spacing {return a;};
COMPLEX   = a:"_Complex"   !IdChar Spacing {return a;};
STDCALL   = a:"_stdcall"   !IdChar Spacing {return a;};
DECLSPEC  = a:"__declspec" !IdChar Spacing {return a;};
ATTRIBUTE = a:"__attribute__" !IdChar Spacing {return a;};
NAMESPACE = a:"namespace"     !IdChar Spacing {return a;};
USING     = a:"using"         !IdChar Spacing {return a;};
TRUE      = a:"true"          !IdChar Spacing {return a;};
FALSE      = a:"false"          !IdChar Spacing {return a;};

Keyword
    = a:( "auto"
      / "break"
      / "case"
      / "char"
      / "const"
      / "continue"
      / "default"
      / "double"
      / "do"
      / "else"
      / "enum"
      / "extern"
      / "float"
      / "for"
      / "goto"
      / "if"
      / "int"
      / "inline"
      / "long"
      / "register"
      / "restrict"
      / "return"
      / "short"
      / "signed"
      / "sizeof"
      / "static"
      / "struct"
      / "switch"
      / "typedef"
      / "union"
      / "unsigned"
      / "void"
      / "volatile"
      / "while"
      / "_Bool"
      / "_Complex"
      / "_Imaginary"
      / "_stdcall"
      / "__declspec"
      / "__attribute__"
      )
    !IdChar {return a;};


//-------------------------------------------------------------------------
//  A.1.3  Identifiers
//  The standard does not explicitly state that identifiers must be
//  distinct from keywords, but it seems so.
//-------------------------------------------------------------------------

Identifier = !Keyword a:IdNondigit b:IdChar* c:InlineSpacing {
    return {type: 'Identifier', val:a+b.join(''), space:c}
};

SeperatorArgs = a:(Keyword / !IdNondigit ![\"\r\n,)] a:_ {return a;}) b:InlineSpacing {
    return {type: 'Seperator', val:a, space:b}
};

Seperator = a:(Keyword / Constant / StringLiteral / !IdNondigit ![\r\n\"] a:_ {return a;}) b:InlineSpacing {
    return {type: 'Seperator', val:handleConstant(input, a), space:b}
};

IdNondigit
    = [a-z] / [A-Z] / [_]
    / UniversalCharacter
    ;

IdChar
    = [a-z] / [A-Z] / [0-9] / [_]
    / UniversalCharacter
    ;


//-------------------------------------------------------------------------
//  A.1.4  Universal character names
//-------------------------------------------------------------------------

UniversalCharacter
    = "\\u" a:HexQuad {return String.fromCharCode(a);}
    / "\\U" a:HexOcto {return String.fromCharCode(a);}
    ;

HexOcto = a:(HexDigit HexDigit HexDigit HexDigit HexDigit HexDigit HexDigit HexDigit) {
    return parseInt(a.join(''),16);
};

HexQuad = a:(HexDigit HexDigit HexDigit HexDigit) {
    return parseInt(a.join(''),16);
};


HexDigit        = [a-f] / [A-F] / [0-9] ;


//-------------------------------------------------------------------------
//  A.1.5  Constants
//-------------------------------------------------------------------------

Constant
    = a:(FloatConstant 
    / IntegerConstant 
    / EnumerationConstant 
    / CharacterConstant
    / BooleanConstant) {return a;}
    ;

BooleanConstant
    = a:(TRUE / FALSE) {
      return a;
    }

IntegerConstant
    = a:( BinaryConstant
      / DecimalConstant
      / HexConstant
      / OctalConstant
      )
    b:IntegerSuffix? {return a;}
    ;

DecimalConstant = a:[1-9] b:[0-9]* {return addPositionInfo({type:'DecimalConstant', value:a + b.join("")});};

OctalConstant   = "0" a:[0-7]* {
  if (a.length>0)
    return addPositionInfo({type:'OctalConstant', value:a.join("")});
  else
    return addPositionInfo({type:'OctalConstant', value:'0'});
};

HexConstant     = HexPrefix a:HexDigit+ {return addPositionInfo({type:'HexConstant', value:a.join("")});};

HexPrefix       = "0x" / "0X" ;

BinaryPrefix    = "0b" ;

BinaryDigit     = [0-1] ;

BinaryConstant  = BinaryPrefix a:BinaryDigit+ {return addPositionInfo({type:'BinaryConstant', value:a.join("")});};

IntegerSuffix
    = [uU] Lsuffix?
    / Lsuffix [uU]?
    ;

Lsuffix
    = "ll"
    / "LL"
    / [lL]
    ;

FloatConstant
    = a:( DecimalFloatConstant
      / HexFloatConstant
      )
    b:FloatSuffix? Spacing {
      if (b)
        return addPositionInfo({type:'FloatConstant', Expression:a});
      else
        return a;
    }
    ;

DecimalFloatConstant
    = a:Fraction b:Exponent? {return addPositionInfo({type:'DecimalFloatConstant', value:a+b||''});}
    / a:[0-9]+ b:Exponent {return addPositionInfo({type:'DecimalFloatConstant', value:a.join('')+b});}
    ;

HexFloatConstant
    = a:HexPrefix b:HexFraction c:BinaryExponent? {return addPositionInfo({type:'HexFloatConstant', value:a+b+c||''});}
    / a:HexPrefix b:HexDigit+ c:BinaryExponent {return addPositionInfo({type:'HexFloatConstant', value:a+b.join('')+c});}
    ;

Fraction
    = a:[0-9]* "." b:[0-9]+ {return a.join('')+'.'+b.join('');}
    / a:[0-9]+ "." {return a.join('');}
    ;

HexFraction
    = a:HexDigit* "." b:HexDigit+ {return a.join('')+'.'+b.join('');}
    / a:HexDigit+ "." {return a.join('')+'.';}
    ;

Exponent = a:[eE] b:[+\-]? c:[0-9]+ {return a+(b||"")+c.join('');};

BinaryExponent = a:[pP][+\-]? b:[0-9]+ {return a+b.join('');};

FloatSuffix = a:[flFL] {return a;};

EnumerationConstant = a:Identifier {return addPositionInfo({type:'EnumerationConstant', Identifier:a});};

CharacterConstant = "L"? "'" a:Char* "'" Spacing {
  return addPositionInfo({type:'CharacterConstant', Char: a});
};

Char = a:Escape {return a;} / ![\'\n\\] a:_ {return a;};

Escape
    = a:(SimpleEscape
    / OctalEscape
    / HexEscape
    / UniversalCharacter) {return a;}
    ;

SimpleEscape = a:"\\" b:[\'\"?\\abfnrtv] {return eval('"' + a + b +'"');};
OctalEscape  = a:"\\" b:[0-7] c:[0-7]? d:[0-7]? {
  var ret = "\"";
  ret += a;
  ret += b;
  if (c)
    ret += c;
  if (d)
    ret += d;
  ret += "\"";
  return eval(ret);
};
HexEscape    = a:"\\x" b:HexDigit+ {return eval('"'+a+b.join('')+'"');};

//-------------------------------------------------------------------------
//  A.1.6  String Literals
//-------------------------------------------------------------------------

StringLiteral = a:("L" / "u8" / "u" / "U")? b:(RawStringLiteral / EscapedStringLiteral) {
  return addPositionInfo({type: 'StringLiteral', prefix:a, value:b});
};

RawStringLiteral = "R" a:("\"" a:RawStringChar* "\"" Spacing {return a.join('');})+ {
  return a.join('');
};

EscapedStringLiteral = a:("\"" a:StringChar* "\"" Spacing {return a.join('');})+ {
  return a.join('');
};

RawStringChar = ![\"\n] a:_ {return a;};

StringChar = Escape / ![\"\n\\] a:_ {return a;};

//-------------------------------------------------------------------------
//  A.1.7  Punctuators
//-------------------------------------------------------------------------

LPAR       =  a:"("         InlineSpacing {return a;};
RPAR       =  a:")"         InlineSpacing {return a;};
COMMA      =  a:","         InlineSpacing {return a;};
LT         =  a:"<"  ![=]   InlineSpacing {return a;};
GT         =  a:">"  ![=]   InlineSpacing {return a;};
QUO        =  a:"\""        InlineSpacing {return a;};

EOT        =  !_    ;

_          =  . ;

