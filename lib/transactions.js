var util = require('./util.js');


/*
function Transaction(params){

    var version = params.version || 1,
        inputs = params.inputs || [],
        outputs = params.outputs || [],
        lockTime = params.lockTime || 0;


    this.toBuffer = function(){
        return Buffer.concat([
            binpack.packUInt32(version, 'little'),
            util.varIntBuffer(inputs.length),
            Buffer.concat(inputs.map(function(i){ return i.toBuffer() })),
            util.varIntBuffer(outputs.length),
            Buffer.concat(outputs.map(function(o){ return o.toBuffer() })),
            binpack.packUInt32(lockTime, 'little')
        ]);
    };

    this.inputs = inputs;
    this.outputs = outputs;

}

function TransactionInput(params){

    var prevOutHash = params.prevOutHash || 0,
        prevOutIndex = params.prevOutIndex,
        sigScript = params.sigScript,
        sequence = params.sequence || 0;


    this.toBuffer = function(){
        sigScriptBuffer = sigScript.toBuffer();
        console.log('scriptSig length ' + sigScriptBuffer.length);
        return Buffer.concat([
            util.uint256BufferFromHash(prevOutHash),
            binpack.packUInt32(prevOutIndex, 'little'),
            util.varIntBuffer(sigScriptBuffer.length),
            sigScriptBuffer,
            binpack.packUInt32(sequence)
        ]);
    };
}

function TransactionOutput(params){

    var value = params.value,
        pkScriptBuffer = params.pkScriptBuffer;

    this.toBuffer = function(){
        return Buffer.concat([
            binpack.packInt64(value, 'little'),
            util.varIntBuffer(pkScriptBuffer.length),
            pkScriptBuffer
        ]);
    };
}

function ScriptSig(params){

    var height = params.height,
        flags = params.flags,
        extraNoncePlaceholder = params.extraNoncePlaceholder;

    this.toBuffer = function(){

        return Buffer.concat([
            util.serializeNumber(height),
            new Buffer(flags, 'hex'),
            util.serializeNumber(Date.now() / 1000 | 0),
            new Buffer([extraNoncePlaceholder.length]),
            extraNoncePlaceholder,
            util.serializeString('/nodeStratum/')
        ]);
    }
};


var Generation = exports.Generation = function Generation(rpcData, publicKey, extraNoncePlaceholder){

    var tx = new Transaction({
        inputs: [new TransactionInput({
            prevOutIndex : Math.pow(2, 32) - 1,
            sigScript    : new ScriptSig({
                height                : rpcData.height,
                flags                 : rpcData.coinbaseaux.flags,
                extraNoncePlaceholder : extraNoncePlaceholder
            })
        })],
        outputs: [new TransactionOutput({
            value          : rpcData.coinbasevalue,
            pkScriptBuffer : publicKey
        })]
    });

    var txBuffer = tx.toBuffer();
    var epIndex  = buffertools.indexOf(txBuffer, extraNoncePlaceholder);
    var p1       = txBuffer.slice(0, epIndex);
    var p2       = txBuffer.slice(epIndex + extraNoncePlaceholder.length);

    this.transaction = tx;
    this.coinbase = [p1, p2];

};
*/


/*
     ^^^^ The above code was a bit slow. The below code is uglier but optimized.
 */



/*
This function creates the generation transaction that accepts the reward for
successfully mining a new block.
For some (probably outdated and incorrect) documentation about whats kinda going on here,
see: https://en.bitcoin.it/wiki/Protocol_specification#tx
 */

var generateOutputTransactions = function(poolRecipient, recipients, rpcData, coin){

    var COIN = 100000000;
    var reward = rpcData.coinbasevalue;
    var rewardToPool = reward;

    var txOutputBuffers = [];

    /* Zoinode compatibility */
    if(rpcData.zoinode)
    {
        if(rpcData.zoinode.payee)
        {
            rpcData.payee = rpcData.zoinode.payee;
            rpcData.payee_amount = rpcData.zoinode.amount;
        }
    }

    /* HexxCoin compatibility */
    if(rpcData.xnode && rpcData.xnode_payments_started)
    {
        if(rpcData.xnode.payee)
        {
            rpcData.payee = rpcData.xnode.payee;
            rpcData.payee_amount = rpcData.xnode.amount;
        }
    }

    /* Dynamic (DYN) compatibility */
    if(rpcData.dynode && rpcData.dynode_payments_started)
    {
        if(rpcData.dynode.payee)
        {
            rpcData.payee = rpcData.dynode.payee;
            rpcData.payee_amount = rpcData.dynode.amount;
        }
    }

    if (coin.symbol == 'NIX')
    {
        if(rpcData.dev_fund)
        {
            if (rpcData.dev_fund.dev_1 && rpcData.dev_fund.dev_2 && rpcData.dev_fund.amount_1 && rpcData.dev_fund.amount_2)
            {
                var payeeScript = util.addressToP2sh(rpcData.dev_fund.dev_1, coin.network);
                txOutputBuffers.push(Buffer.concat([
                    util.packInt64LE(rpcData.dev_fund.amount_1),
                    util.varIntBuffer(payeeScript.length),
                    payeeScript
                ]));
                var payeeScript = util.addressToP2sh(rpcData.dev_fund.dev_2, coin.network);
                txOutputBuffers.push(Buffer.concat([
                    util.packInt64LE(rpcData.dev_fund.amount_2),
                    util.varIntBuffer(payeeScript.length),
                    payeeScript
                ]));
            }
        }

        if (rpcData.ghostnode_payments_started == true)
        {
            if (rpcData.ghostnode.payee && rpcData.ghostnode.amount)
            {
                var payeeScript = util.addressToScript(rpcData.ghostnode.payee);
                txOutputBuffers.push(Buffer.concat([
                    util.packInt64LE(rpcData.ghostnode.amount),
                    util.varIntBuffer(payeeScript.length),
                    payeeScript
                ]));
            }
        }
    }

    if (rpcData.payee) {
    var payeeReward = 0;

        if (rpcData.payee_amount) {
            payeeReward = rpcData.payee_amount;
        } else {
            payeeReward = Math.ceil(reward / 5);
        }

        if(rpcData.zoinode || rpcData.xnode)
        {
        }
        else
        {
            reward -= payeeReward;
            rewardToPool -= payeeReward;
        }

        var payeeScript = util.addressToScript(rpcData.payee);
        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(payeeReward),
            util.varIntBuffer(payeeScript.length),
            payeeScript
        ]));
    }

    /* HexxCoin Founders Reward */
    if(coin.symbol == 'HXX')
    {
        var founderScript1 = util.addressToScript('HE7NSv3jevUAPjwsLGpoYSz9ftzV9S36Xq');
        var founderScript2 = util.addressToScript('HNdzbEtifr2nTd3VBvUWqJLc35ZFXr2EYo');
        var founderScript3 = util.addressToScript('H7HxEDxnirWkH7AnXPKDpwA8juU5XxyAVP');
        var founderScript4 = util.addressToScript('H94j1zMAbWwHWcEq8hUogAMALpVzj34M6Q');
        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(0.1 * COIN),
            util.varIntBuffer(founderScript1.length),
            founderScript1
        ]));
        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(0.1 * COIN),
            util.varIntBuffer(founderScript2.length),
            founderScript2
        ]));
        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(0.1 * COIN),
            util.varIntBuffer(founderScript3.length),
            founderScript3
        ]));
        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(0.3 * COIN),
            util.varIntBuffer(founderScript4.length),
            founderScript4
        ]));
    }

    for (var i = 0; i < recipients.length; i++){
        var recipientReward = Math.floor(recipients[i].percent * reward);
        rewardToPool -= recipientReward;

        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(recipientReward),
            util.varIntBuffer(recipients[i].script.length),
            recipients[i].script
        ]));
    }


    txOutputBuffers.unshift(Buffer.concat([
        util.packInt64LE(rewardToPool),
        util.varIntBuffer(poolRecipient.length),
        poolRecipient
    ]));

    if (rpcData.default_witness_commitment !== undefined){
        witness_commitment = new Buffer(rpcData.default_witness_commitment, 'hex');
        txOutputBuffers.unshift(Buffer.concat([
            util.packInt64LE(0),
            util.varIntBuffer(witness_commitment.length),
            witness_commitment
        ]));
    }

    return Buffer.concat([
        util.varIntBuffer(txOutputBuffers.length),
        Buffer.concat(txOutputBuffers)
    ]);

};


exports.CreateGeneration = function(rpcData, publicKey, extraNoncePlaceholder, reward, txMessages, recipients, auxMerkleTree, coinbaseText, coin){

    var txInputsCount = 1;
    var txOutputsCount = 1;
    var txVersion = txMessages === true ? 2 : 1;
    var txLockTime = 0;

    var txInPrevOutHash = 0;
    var txInPrevOutIndex = Math.pow(2, 32) - 1;
    var txInSequence = 0;

    //Only required for POS coins
    var txTimestamp = reward === 'POS' ?
        util.packUInt32LE(rpcData.curtime) : new Buffer([]);

    //For coins that support/require transaction comments
    var txComment = txMessages === true ?
        util.serializeString('https://github.com/UNOMP/node-merged-pool') :
        new Buffer([]);


    var scriptSigPart1 = Buffer.concat([
        util.serializeNumber(rpcData.height),
        new Buffer(rpcData.coinbaseaux.flags, 'hex'),
        util.serializeNumber(Date.now() / 1000 | 0),
        new Buffer([extraNoncePlaceholder.length]),
        new Buffer('fabe6d6d', 'hex'),
        util.reverseBuffer(auxMerkleTree.root),
        util.packUInt32LE(auxMerkleTree.data.length),
        util.packUInt32LE(0)
    ]);

    if(coinbaseText === undefined || coinbaseText == null)
    {
        var scriptSigPart2 = util.serializeString('/nodeStratum/');
    }
    else
    {
        var scriptSigPart2 = util.serializeString('/' + coinbaseText + '/');
    }

    var p1 = Buffer.concat([
        util.packUInt32LE(txVersion),
        txTimestamp,

        //transaction input
        util.varIntBuffer(txInputsCount),
        util.uint256BufferFromHash(txInPrevOutHash),
        util.packUInt32LE(txInPrevOutIndex),
        util.varIntBuffer(scriptSigPart1.length + extraNoncePlaceholder.length + scriptSigPart2.length),
        scriptSigPart1
    ]);


    /*
    The generation transaction must be split at the extranonce (which located in the transaction input
    scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
    a valid share and/or block.
     */


    var outputTransactions = generateOutputTransactions(publicKey, recipients, rpcData, coin);

    var p2 = Buffer.concat([
        scriptSigPart2,
        util.packUInt32LE(txInSequence),
        //end transaction input

        //transaction output
        outputTransactions,
        //end transaction ouput

        util.packUInt32LE(txLockTime),
        txComment
    ]);

    return [p1, p2];

};
