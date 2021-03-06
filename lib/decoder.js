'use strict';

const TOKEN_TRUE = -1;
const TOKEN_FALSE = -2;
const TOKEN_NULL = -3;
const TOKEN_EMPTY_STRING = -4;
const TOKEN_UNDEFINED = -5;

const REG_STR_REPLACER = /\+|%2B|%7C|%5E|%25/g;
const DECODER_REPLACER = {
  '+': ' ',
  '%2B': '+',
  '%7C': '|',
  '%5E': '^',
  '%25': '%',
};
const TOKEN_SET = new Set([ '|', '$', '@', '*', '#', ']' ]);

class JSONDecoder {
  constructor() {
    this.dictionary = [];
    this.tokens = [];
    this.tokensIndex = 0;
  }

  _decodeString(str) {
    return str.replace(REG_STR_REPLACER, a => DECODER_REPLACER[a]);
  }

  _decodeDate(str) {
    return new Date(this._base36To10(str));
  }

  _base36To10(num) {
    return parseInt(num, 36);
  }

  _unpack() {
    const token = this.tokens[this.tokensIndex];

    switch (token) {
      case '@': {
        const arr = [];
        const tokensLen = this.tokens.length;

        for (this.tokensIndex++; this.tokensIndex < tokensLen; this.tokensIndex++) {
          const token = this.tokens[this.tokensIndex];

          if (token === ']') {
            return arr;
          }
          arr.push(this._unpack());
        }
        return arr;
      }
      case '$': {
        const obj = {};
        const tokensLen = this.tokens.length;

        for (this.tokensIndex++; this.tokensIndex < tokensLen; this.tokensIndex++) {
          const token = this.tokens[this.tokensIndex];

          if (token === ']') {
            return obj;
          }
          const key = this._unpack();

          this.tokensIndex++;
          obj[key] = this._unpack();
        }
        return obj;
      }
      case '*': {
        const arr = [];
        const tokensLen = this.tokens.length;

        for (this.tokensIndex++; this.tokensIndex < tokensLen; this.tokensIndex++) {
          const token = this.tokens[this.tokensIndex];

          if (token === ']') {
            return new Buffer(arr);
          }
          arr.push(this._unpack());
        }
        return new Buffer(arr);
      }
      case '#': {
        const obj = {};
        const tokensLen = this.tokens.length;

        for (this.tokensIndex++; this.tokensIndex < tokensLen; this.tokensIndex++) {
          const token = this.tokens[this.tokensIndex];

          if (token === ']') {
            const err = new Error(obj.message);

            Object.assign(err, obj);
            return err;
          }
          const key = this._unpack();

          this.tokensIndex++;
          obj[key] = this._unpack();
        }
        const err = new Error(obj.message);

        Object.assign(err, obj);
        return err;
      }
      case TOKEN_TRUE:
        return true;
      case TOKEN_FALSE:
        return false;
      case TOKEN_NULL:
        return null;
      case TOKEN_EMPTY_STRING:
        return '';
      case TOKEN_UNDEFINED:
        return undefined;
      default:
        return this.dictionary[token];
    }
  }

  decode(buf) {
    this.dictionary = [];
    this.tokens = [];
    this.tokensIndex = 0;

    const packed = buf.toString();
    const arr = packed.split('^');

    if (arr[0]) {
      const strArr = arr[0].split('|');

      for (const str of strArr) {
        this.dictionary.push(this._decodeString(str));
      }
    }

    if (arr[1]) {
      const intArr = arr[1].split('|');

      for (const int of intArr) {
        this.dictionary.push(this._base36To10(int));
      }
    }

    if (arr[2]) {
      const floatArr = arr[2].split('|');

      for (const float of floatArr) {
        this.dictionary.push(parseFloat(float));
      }
    }

    if (arr[3]) {
      const dateArr = arr[3].split('|');

      for (const date of dateArr) {
        this.dictionary.push(this._decodeDate(date));
      }
    }

    let tmp = '';

    for (let i = 0, len = arr[4].length; i < len; ++i) {
      const symbol = arr[4][i];

      if (TOKEN_SET.has(symbol)) {
        if (tmp) {
          this.tokens.push(this._base36To10(tmp));
          tmp = '';
        }
        if (symbol !== '|') {
          this.tokens.push(symbol);
        }
      } else {
        tmp += symbol;
      }
    }
    if (tmp) {
      this.tokens.push(this._base36To10(tmp));
    }
    return this._unpack();
  }
}

module.exports = JSONDecoder;
