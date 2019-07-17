var crypto = require('crypto');
'use strict';

module.exports = (function () {
    var fpe_algos = ['prefix-cipher', 'cycle-walking', 'feistel-network'];
    var version = '0.1';

    function get_presets() {
        var preset_string = ['Harpo.js v' + version + ' domain presets'];

        fpe_algos.forEach(function(algo) {
            var fpe_module = require('../modules/' + algo);
            var algo_preset = fpe_module.algorithm_presets();
            preset_string.push(algo + ':\n' + algo_preset);
        });
        preset_string = preset_string.join('\n');

        return preset_string;
    }

    function cipher (key, iv, fpe_algorithm, cipher_algorithm, domain_options) {
        var cipher_obj = {};

        if (!key) throw new Error(`"key" is required`);
        if (!fpe_algorithm) {
            fpe_algorithm = 'prefix-cipher';
        }
        else {
            if(fpe_algos.indexOf(fpe_algorithm) === -1) {
                throw new Error(`Invalid FPE algorithm provided: ` + JSON.stringify(fpe_algorithm) + `. Required (one of): ` + JSON.stringify(fpe_algos.join(', ')));
            }
        }
        if (!cipher_algorithm) cipher_algorithm = 'aes-256-cbc';

        try {
            var ciph = crypto.createCipheriv(cipher_algorithm, key, iv);
        } catch (error) {
            throw new Error(error.message);
        }

        cipher_obj.key = key;
        cipher_obj.iv = iv;
        cipher_obj.fpe_algorithm = fpe_algorithm;
        cipher_obj.cipher_algorithm = cipher_algorithm;

        var text_chars;
        var residual_chars;
        var additional_chars;
        var domain = [];

        var fpe_module = require('../modules/' + fpe_algorithm);

        if(domain_options) {
            if(domain_options.type) {
                if (domain_options.type === 'default') {
                    text_chars = true;
                } else {
                    if(!domain_options.domain && ['input', 'preset', 'ascii-range'].indexOf(domain_options.type) !== -1)
                        throw new Error(`"domain" argument not provided for domain type ` + JSON.stringify(domain_options.type) + ` (domain_options)`);

                    if (domain_options.type === 'input') {
                        if (typeof domain_options.domain !== 'string')
                            throw new Error(`Invalid "domain" argument format: ` + JSON.stringify(domain_options.domain) + ` (domain_options). Required: string of chars`);

                        domain_options.domain.split('').forEach(function (char) {
                            if (domain.indexOf(char) === -1)
                                domain.push(char);
                        });
                    } else if (domain_options.type === 'preset') {
                        var domain_presets = fpe_module.domain_presets;
                        var domain_set = domain_presets[domain_options.domain];
                        if (!domain_set)
                            throw new Error(`Invalid domain "preset": ` + JSON.stringify(domain_options.domain) + ` provided for `
                                + JSON.stringify(fpe_algorithm) + ` (domain_options). Required (one of): `
                                + JSON.stringify(Object.keys(domain_presets).join(', ')));

                        for (var index1 = 0; index1 < domain_set.length; index1++) {
                            for (var index2 = 0; index2 < domain_set[index1].length; index2++) {
                                domain.push(domain_set[index1].split('')[index2]);
                            }
                        }
                    } else if (domain_options.type === 'ascii-range') {
                        var verify_range = function (range) {
                            if(typeof range === 'string' && range.split('-').length === 2) {
                                var ascii_range = {
                                    start: range.split('-')[0],
                                    end: range.split('-')[1]
                                };

                                if (!ascii_range.start) throw new Error(`ASCII range "start" argument required (domain_options)`);
                                if (!ascii_range.end) throw new Error(`ASCII range "end" argument required (domain_options)`);
                                ascii_range.start = Number(ascii_range.start);
                                ascii_range.end = Number(ascii_range.end);

                                if (typeof ascii_range.start !== 'number') throw new Error(`ASCII range "start" argument must be a number (domain_options)`);
                                if (typeof ascii_range.end !== 'number') throw new Error(`ASCII range "end" argument must be a number (domain_options)`);
                                if (ascii_range.start > ascii_range.end) throw new Error(`ASCII range "start" argument greater than 'end' argument (domain_options)`);
                                if (ascii_range.start === ascii_range.end) throw new Error(`ASCII range "start" argument same as 'end' argument (domain_options)`);

                                return ascii_range;
                            }
                            else {
                                throw new Error(`Invalid "ASCII range" argument format: ` + JSON.stringify(range)
                                    + ` (domain_options). Required: string of format "startNo-endNo"`);
                            }
                        };

                        if(Array.isArray(domain_options.domain)) {
                            for(var index = 0; index < domain_options.domain.length; index++) {
                                try {
                                    var ascii_range = verify_range(domain_options.domain[index]);
                                } catch (error) {
                                    throw error;
                                }

                                for (var index2 = ascii_range.start; index2 <= ascii_range.end; index2++) {
                                    domain.push(String.fromCharCode(index2));
                                }
                            }
                        }
                        else {
                            try {
                                var ascii_range = verify_range(domain_options.domain);
                            } catch (error) {
                                throw error;
                            }
                            for (var index = ascii_range.start; index <= ascii_range.end; index++) {
                                domain.push(String.fromCharCode(index));
                            }
                        }
                    } else {
                        throw new Error(`Invalid domain "type" argument provided: ` + JSON.stringify(domain_options.type) +
                            ` (domain_options). Required (one of): ` +  JSON.stringify(['input', 'preset', 'ascii-range'].join(', ')));
                    }

                    if (domain_options.residual_chars) {
                        residual_chars = true;
                    }
                }
            } else {
                text_chars = true;
            }

            if(domain_options.additional_chars) {
                let additional_set = domain_options.additional_chars;
                if(Array.isArray(additional_set)) {
                    for(var index1 = 0; index1 < additional_set.length; index1++) {
                        for(var index2 = 0; index2 < additional_set[index1].length; index2++) {
                            if(domain.indexOf(additional_set[index1].split('')[index2]) === -1)
                                domain.push(additional_set[index1].split('')[index2]);
                        }
                    }
                }
                else if(typeof additional_set == 'string') {
                    for(var index1 = 0; index1 < additional_set.length; index1++) {
                        if(domain.indexOf(additional_set.split('')[index1]) === -1)
                            domain.push(additional_set.split('')[index1]);
                    }
                }
                additional_chars = true;
            }
        }
        else
        {
            text_chars = true;
        }

        let shuffle_result = fpe_module.shuffle_domain(domain, cipher_obj.key, cipher_obj.iv, cipher_obj.cipher_algorithm);

        cipher_obj.domain_data = {
            domain: domain,
            text_chars: text_chars,
            residual_chars: residual_chars,
            additional_chars: additional_chars,
            encrypted_table: shuffle_result.encrypted_table,
            decrypted_table: shuffle_result.decrypted_table
        };

        cipher_obj.encrypt = encrypt;
        cipher_obj.decrypt = decrypt;

        return cipher_obj;
    }

    function encrypt(text) {
        if (typeof text !== 'string') throw new Error(`"input" is not a string: ` + text);
        if(text.length === 0) throw new Error(`"input" length is 0`);

        if(this.fpe_algorithm === 'prefix-cipher') {
            var fpe_module = require('../modules/' + this.fpe_algorithm);

            if(this.domain_data.text_chars) {
                fpe_module.use_custom_domain(text, this, false);
            }
            else if(this.domain_data.residual_chars) {
                fpe_module.use_custom_domain(text, this, true);
            }

            let cipher_obj = this;
            const encrypted = text
                .split('')
                .map(function (char) {
                    return cipher_obj.domain_data.encrypted_table[char];
                })
                .join('');

            fpe_module.validate(text, encrypted, cipher_obj.domain_data.domain);
            return encrypted;
        }

    }

    function decrypt(text) {
        if (typeof text !== 'string') throw new Error(`"input" is not a string: ` + text);
        if(text.length === 0) throw new Error(`"input" length is 0`);

        if(this.fpe_algorithm === 'prefix-cipher') {
            var fpe_module = require('../modules/' + this.fpe_algorithm);

            let cipher_obj = this;
            const decrypted = text
                .split('')
                .map(function (char) {
                    return cipher_obj.domain_data.decrypted_table[char];
                })
                .join('');

            fpe_module.validate(text, decrypted, cipher_obj.domain_data.domain);
            return decrypted;
        }
    }

    return {
        cipher: cipher,
        presets: get_presets
    }
})();