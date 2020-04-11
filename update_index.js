const minimist = require('minimist')
require('console-stamp')(console, '[HH:MM:ss.l]')
const Web3 = require("web3")
const BigNumber = require('bignumber.js')
const AMM = require('./abi/AMM.json')
const fetch = require('node-fetch')
const fs = require('fs')

function parseArgs() {
    const args = minimist(process.argv.slice(2), opts={
        string: ['keystore', 'password', 'rpc', 'amm'],
    })
    let failed = false
    if (args['h'] || args['help']) {
        failed = true
    }
    if (!args['keystore'] || !args['rpc'] || !args['amm']) {
        failed = true
    }
    if (failed) {
        console.log(`Usage: node update_index.js --keystore=<path> --password= --rpc=https://ropsten.infura.io --amm=0x1234`)
        return null
    }
    return args
}

function getAMM(args) {
    web3 = new Web3(args.rpc)
    const amm = new web3.eth.Contract(AMM, args.amm)
    return { web3, amm }
}

// return true if the index are the same
async function checkPrice(args) {
    const { amm } = getAMM(args)
    const indexPriceAndTimestamp = await amm.methods.indexPrice().call()
    const indexPrice = new BigNumber(indexPriceAndTimestamp.price).shiftedBy(-18)
    console.log(`       index: ${indexPrice.toFixed()}`)

    const funding = await amm.methods.lastFundingState().call()
    const fundingIndexPrice = new BigNumber(funding.lastIndexPrice).shiftedBy(-18)
    console.log(`fundingIndex: ${fundingIndexPrice.toFixed()}`)

    return indexPrice.eq(fundingIndexPrice)
}

async function getGasPrices() {
    const result = await fetch('https://ethgasstation.info/json/ethgasAPI.json')
    const {
        fastest,
        fast,
        average,
        safeLow,
    } = await result.json()
    return {
        average: new BigNumber(average).div(10).shiftedBy(9),
        fast: new BigNumber(fast).div(10).shiftedBy(9),
        fastest: new BigNumber(fastest).div(10).shiftedBy(9),
        safeLow: new BigNumber(safeLow).div(10).shiftedBy(9),
    }
}

async function updateIndex(args, gas) {
    const { web3, amm } = getAMM(args)
    const keystore = JSON.parse(fs.readFileSync(args.keystore, 'utf8'))
    const decryptedAccount = web3.eth.accounts.decrypt(keystore, args.password)
    const rawTransaction = {
        to: args.amm,
        gas: 400000,
        gasPrice: gas.fast.toFixed(),
        data: await amm.methods.updateIndex().encodeABI(),
    }
    console.log(rawTransaction)
    const signed = await decryptedAccount.signTransaction(rawTransaction)
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction)
    console.log('receipt:', receipt)
}

async function main() {
    const args = parseArgs()
    if (!args) {
        return
    }
    const isTheSamePrice = checkPrice(args)
    if (isTheSamePrice) {
        console.log('not modified. exit')
        return
    }
    const gas = await getGasPrices()
    console.log(`gasPrice: ${gas.fastest.toFixed()}`)
    await updateIndex(args, gas)
    console.log('jobs done')
}

main().then()
