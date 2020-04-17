import * as ethers from 'ethers'

import { MaciState } from 'maci-core'

import {
    PubKey,
    PrivKey,
    Keypair,
} from 'maci-domainobjs'

import {
    maciContractAbi,
    initialVoiceCreditProxyAbi,
    genTestAccounts,
} from 'maci-contracts'

import { genPubKey } from 'maci-crypto'

import { config } from 'maci-config'

import { exec } from './utils'

const accounts = genTestAccounts(1)

const calcTreeDepthFromMaxLeaves = (maxLeaves: number) => {
    return Math.ceil(Math.log(maxLeaves) / Math.log(2))
}

describe('create CLI subcommand', () => {
    let maciContract

    const coordinatorKeypair = new Keypair()

    it('create should deploy a MACI contract', async () => {
        const providerUrl = config.get('chain.url')
        const maciPrivkey = coordinatorKeypair.privKey.serialize()
        const deployerPrivKey = accounts[0].privateKey
        const maxUsers = 2 ** 4 - 1
        const maxMessages = 2 ** 4 - 1
        const maxVoteOptions = 15
        const signupDuration = 600
        const votingDuration = 1
        const messageBatchSize = 4
        const tallyBatchSize = 4
        const initialVoiceCredits = 1000

        const command = `node ../cli/build/index.js create` +
            ` -d ${deployerPrivKey} -sk ${maciPrivkey}` +
            ` -u ${maxUsers}` +
            ` -m ${maxMessages}` +
            ` -v ${maxVoteOptions}` +
            ` -e ${providerUrl}` +
            ` -s ${signupDuration}` +
            ` -o ${votingDuration}` +
            ` -bm ${messageBatchSize}` +
            ` -bv ${tallyBatchSize}` +
            ` -c ${initialVoiceCredits}`
        console.log(command)
        
        const output = exec(command).stdout.trim()

        console.log(command)
        console.log(output)

        const regMatch = output.match(/^MACI: (0x[a-fA-F0-9]{40})$/)
        const maciAddress = regMatch[1]

        const provider = new ethers.providers.JsonRpcProvider(providerUrl)
        const maciContract = new ethers.Contract(
            maciAddress,
            maciContractAbi,
            provider,
        )

        const stateTreeDepth = calcTreeDepthFromMaxLeaves(maxUsers)
        const messageTreeDepth = calcTreeDepthFromMaxLeaves(maxMessages)
        const voteOptionTreeDepth = calcTreeDepthFromMaxLeaves(maxVoteOptions)

        // Check if the on-chain state tree root and message tree roots are
        // correct. This tells us that their tree depths were set correctly.
        const maciState = new MaciState(
            coordinatorKeypair,
            stateTreeDepth,
            messageTreeDepth,
            voteOptionTreeDepth,
            maxVoteOptions,
        )

        const onChainStateRoot = await maciContract.getStateTreeRoot()
        const onChainMessageRoot = await maciContract.getMessageTreeRoot()
        expect(maciState.genStateRoot().toString()).toEqual(onChainStateRoot.toString())
        expect(maciState.genMessageRoot().toString()).toEqual(onChainMessageRoot.toString())

        // Check if the other settings were correctly set in the contract
        const onChainMaxVoteOptions = await maciContract.voteOptionsMaxLeafIndex()
        expect(maxVoteOptions.toString()).toEqual(onChainMaxVoteOptions.toString())

        const onChainSignUpDuration = await maciContract.signUpDurationSeconds()
        expect(onChainSignUpDuration.toString()).toEqual(signupDuration.toString())

        const onChainVotingDuration = await maciContract.votingDurationSeconds()
        expect(onChainVotingDuration.toString()).toEqual(votingDuration.toString())

        const onChainMaxUsers = await maciContract.maxUsers()
        expect(onChainMaxUsers.toString()).toEqual(maxUsers.toString())

        const onChainMaxMessages = await maciContract.maxMessages()
        expect(onChainMaxMessages.toString()).toEqual(maxMessages.toString())

        const onChainMessageBatchSize = await maciContract.messageBatchSize()
        expect(onChainMessageBatchSize.toString()).toEqual(messageBatchSize.toString())

        const onChainTallyBatchSize = await maciContract.tallyBatchSize()
        expect(onChainTallyBatchSize.toString()).toEqual(tallyBatchSize.toString())

        const ivcpContractAddress = await maciContract.initialVoiceCreditProxy()
        const ivcpContract = new ethers.Contract(
            ivcpContractAddress,
            initialVoiceCreditProxyAbi,
            provider,
        )

        const onChainIvc = await ivcpContract.getVoiceCredits(
            '0x0000000000000000000000000000000000000000',
            '0x0'
        )
        expect(onChainIvc.toString()).toEqual(initialVoiceCredits.toString())
    })
})
