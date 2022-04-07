import { ethers } from 'hardhat';
import hardhatConfig from '../hardhat.config';
import { Umbra } from '../src/classes/Umbra';
import { BigNumberish, BigNumber, JsonRpcProvider, Wallet } from '../src/ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { HardhatNetworkHDAccountsUserConfig } from 'hardhat/src/types/config';
import { expect } from 'chai';
import { expectRejection } from './utils';
import { testPrivateKeys } from './testPrivateKeys';
import type { ChainConfig } from '../src/types';
import {
  TestToken as ERC20,
  Umbra as UmbraContract,
  TestTokenFactory as ERC20__factory,
  UmbraFactory as Umbra__factory,
} from '@umbra/contracts-core/typechain';

const { parseEther } = ethers.utils;
const ethersProvider = ethers.provider;
const jsonRpcProvider = new JsonRpcProvider(hardhatConfig.networks?.hardhat?.forking?.url);

const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const quantity = parseEther('5');
const overrides = { supportPubKey: true }; // we directly enter a pubkey in these tests for convenience

// We don't use the 0 or 1 index just to reduce the chance of conflicting with a signer for another use case
const senderIndex = 2;
const receiverIndex = 3;

describe('Umbra class', () => {
  let sender: Wallet;
  let receiver: Wallet;
  let deployer: SignerWithAddress;

  let dai: ERC20;
  let umbra: Umbra;
  let chainConfig: ChainConfig;

  const getEthBalance = async (address: string) => {
    return (await ethersProvider.getBalance(address)).toString();
  };
  const verifyEqualValues = (val1: BigNumberish, val2: BigNumberish) => {
    expect(BigNumber.from(val1).toString()).to.equal(BigNumber.from(val2).toString());
  };

  before(async () => {
    // Load signers' mnemonic and derivation path from hardhat config
    const accounts = hardhatConfig.networks?.hardhat?.accounts as HardhatNetworkHDAccountsUserConfig;
    const { mnemonic, path } = accounts;

    // Get the wallets of interest. The hardhat signers are generated by appending "/index" to the derivation path,
    // so we do the same to instantiate our wallets. Private key can now be accessed by `sender.privateKey`
    sender = ethers.Wallet.fromMnemonic(mnemonic as string, `${path as string}/${senderIndex}`);
    sender.connect(ethers.provider);
    receiver = ethers.Wallet.fromMnemonic(mnemonic as string, `${path as string}/${receiverIndex}`);
    receiver.connect(ethers.provider);

    // Load other signers
    deployer = (await ethers.getSigners())[0]; // used for deploying contracts
  });

  beforeEach(async () => {
    // Deploy Umbra
    const toll = parseEther('0.1');
    const tollCollector = ethers.constants.AddressZero; // doesn't matter for these tests
    const tollReceiver = ethers.constants.AddressZero; // doesn't matter for these tests
    const umbraFactory = new Umbra__factory(deployer);
    const umbraContract = (await umbraFactory.deploy(toll, tollCollector, tollReceiver)) as UmbraContract;
    await umbraContract.deployTransaction.wait();

    // Deploy mock tokens
    const daiFactory = new ERC20__factory(deployer);
    dai = (await daiFactory.deploy('Dai', 'DAI')) as ERC20;
    await dai.deployTransaction.wait();

    // Get chainConfig based on most recent Rinkeby block number to minimize scanning time
    const lastBlockNumber = await ethersProvider.getBlockNumber();
    chainConfig = {
      chainId: (await ethersProvider.getNetwork()).chainId,
      umbraAddress: umbraContract.address,
      startBlock: lastBlockNumber,
      subgraphUrl: 'https://api.thegraph.com/subgraphs/name/scopelift/umbrapolygon',
    };

    // Get Umbra instance
    umbra = new Umbra(ethersProvider, chainConfig);
  });

  describe('Initialization', () => {
    it('initializes correctly when passing a chain config', async () => {
      // URL provider
      const umbra1 = new Umbra(jsonRpcProvider, chainConfig);
      expect(umbra1.provider._isProvider).to.be.true;
      expect(umbra1.chainConfig.umbraAddress).to.equal(chainConfig.umbraAddress);
      expect(umbra1.chainConfig.startBlock).to.equal(chainConfig.startBlock);
      expect(umbra1.chainConfig.subgraphUrl).to.equal(chainConfig.subgraphUrl);

      // Web3 provider
      const umbra2 = new Umbra(ethersProvider, chainConfig);
      expect(umbra2.provider._isProvider).to.be.true;
      expect(umbra2.chainConfig.umbraAddress).to.equal(chainConfig.umbraAddress);
      expect(umbra2.chainConfig.startBlock).to.equal(chainConfig.startBlock);
      expect(umbra2.chainConfig.subgraphUrl).to.equal(chainConfig.subgraphUrl);
    });

    it('initializes correctly when passing a default chainId', async () => {
      // --- Localhost ---
      // URL provider
      const umbra1 = new Umbra(jsonRpcProvider, 1337);
      expect(umbra1.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra1.chainConfig.startBlock).to.equal(8505089);
      expect(umbra1.chainConfig.subgraphUrl).to.equal(false);

      // Web3 provider
      const umbra2 = new Umbra(ethersProvider, 1337);
      expect(umbra2.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra2.chainConfig.startBlock).to.equal(8505089);
      expect(umbra2.chainConfig.subgraphUrl).to.equal(false);

      // --- Rinkeby ---
      const umbra3 = new Umbra(jsonRpcProvider, 4);
      expect(umbra3.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra3.chainConfig.startBlock).to.equal(8505089);
      // expect(umbra3.chainConfig.subgraphUrl).to.equal('https://api.thegraph.com/subgraphs/name/scopelift/umbrarinkeby');
      expect(umbra3.chainConfig.subgraphUrl).to.equal(false);

      // --- Mainnet ---
      const umbra4 = new Umbra(jsonRpcProvider, 1);
      expect(umbra4.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra4.chainConfig.startBlock).to.equal(12343914);
      expect(umbra4.chainConfig.subgraphUrl).to.equal('https://api.thegraph.com/subgraphs/name/scopelift/umbramainnet');

      // --- Optimism ---
      const umbra5 = new Umbra(jsonRpcProvider, 10);
      expect(umbra5.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra5.chainConfig.startBlock).to.equal(4069556);
      expect(umbra5.chainConfig.subgraphUrl).to.equal('https://api.thegraph.com/subgraphs/name/scopelift/umbraoptimism'); // prettier-ignore

      // --- Polygon ---
      const umbra6 = new Umbra(jsonRpcProvider, 137);
      expect(umbra6.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra6.chainConfig.startBlock).to.equal(20717318);
      expect(umbra6.chainConfig.subgraphUrl).to.equal('https://api.thegraph.com/subgraphs/name/scopelift/umbrapolygon');

      // --- Arbitrum ---
      const umbra7 = new Umbra(jsonRpcProvider, 42161);
      expect(umbra7.chainConfig.umbraAddress).to.equal('0xFb2dc580Eed955B528407b4d36FfaFe3da685401');
      expect(umbra7.chainConfig.startBlock).to.equal(7285883);
      expect(umbra7.chainConfig.subgraphUrl).to.equal('https://api.thegraph.com/subgraphs/name/scopelift/umbraarbitrumone'); // prettier-ignore
    });

    it('does not allow invalid default chain IDs to be provided', async () => {
      const msg = 'Unsupported chain ID provided';
      const constructor1 = () => new Umbra(jsonRpcProvider, 999);
      const constructor2 = () => new Umbra(ethersProvider, 999);
      expect(constructor1).to.throw(msg);
      expect(constructor2).to.throw(msg);
    });
  });

  describe('Private key generation', () => {
    it('properly generates private keys', async () => {
      // We use 100 because that's how many initial accounts are generated in the hardhat config
      for (let i = 0; i < 100; i += 1) {
        // We must use a default hardhat account so hardhat has access to the private key to sign with
        // `provider.send('personal_sign', [params])`, but we instantiate the wallet manually with the
        // private key since the SignerWithAddress type is not a valid input type to generatePrivateKeys

        const walletHardhat = (await ethers.getSigners())[i];
        const wallet = new Wallet(testPrivateKeys[i]);
        if (walletHardhat.address !== wallet.address) throw new Error('Address mismatch');

        const { spendingKeyPair, viewingKeyPair } = await umbra.generatePrivateKeys(wallet);
        expect(spendingKeyPair.privateKeyHex).to.have.length(66);
        expect(viewingKeyPair.privateKeyHex).to.have.length(66);
      }
    });
  });

  describe('Send, scan, and withdraw funds', () => {
    beforeEach(() => {
      // Seems we somehow lose the provider attached to our sender, so make sure it's there. Without this
      // some tests below throw with "Error: missing provider (operation="sendTransaction", code=UNSUPPORTED_OPERATION, version=abstract-signer/5.0.12)"
      sender = sender.connect(ethers.provider);
    });

    const mintAndApproveDai = async (signer: Wallet, user: string, amount: BigNumber) => {
      await dai.connect(signer).mint(user, amount);
      await dai.connect(signer).approve(umbra.umbraContract.address, ethers.constants.MaxUint256);
    };

    it('reverts if sender does not have enough tokens', async () => {
      const msg = `Insufficient balance to complete transfer. Has 0 tokens, tried to send ${quantity.toString()} tokens.`;
      await expectRejection(umbra.send(sender, dai.address, quantity, receiver.address), msg);
    });

    it('reverts if sender does not have enough ETH', async () => {
      // ETH balance is checked by ethers when sending a transaction and therefore does not need to
      // be tested here. If the user has insufficient balance it will throw with
      // `insufficient funds for gas * price + value`
    });

    it('Without payload extension: send tokens, scan for them, withdraw them', async () => {
      // SENDER
      // Mint Dai to sender, and approve the Umbra contract to spend their DAI
      await mintAndApproveDai(sender, sender.address, quantity);

      // Send funds with Umbra
      const { tx, stealthKeyPair } = await umbra.send(sender, dai.address, quantity, receiver!.publicKey, overrides);
      await tx.wait();

      // RECEIVER
      // Receiver scans for funds sent to them
      const { userAnnouncements } = await umbra.scan(receiver.publicKey, receiver.privateKey);
      expect(userAnnouncements.length).to.be.greaterThan(0);

      // Withdraw (test regular withdrawal, so we need to transfer ETH to pay gas)
      // Destination wallet should have a balance equal to amount sent

      // First we send ETH to the stealth address
      await sender.sendTransaction({ to: stealthKeyPair.address, value: parseEther('1') });

      // Now we withdraw the tokens
      const stealthPrivateKey = Umbra.computeStealthPrivateKey(receiver.privateKey, userAnnouncements[0].randomNumber);
      const destinationWallet = ethers.Wallet.createRandom();
      verifyEqualValues(await dai.balanceOf(destinationWallet.address), 0);
      const withdrawTxToken = await umbra.withdraw(stealthPrivateKey, dai.address, destinationWallet.address);
      await withdrawTxToken.wait();
      verifyEqualValues(await dai.balanceOf(destinationWallet.address), quantity);
      verifyEqualValues(await dai.balanceOf(stealthKeyPair.address), 0);

      // And for good measure let's withdraw the rest of the ETH
      const initialEthBalance = await getEthBalance(stealthKeyPair.address);
      const withdrawTxEth = await umbra.withdraw(stealthPrivateKey, ETH_ADDRESS, destinationWallet.address);
      await withdrawTxEth.wait();
      const withdrawEthReceipt = await ethersProvider.getTransactionReceipt(withdrawTxEth.hash);
      const withdrawTokenTxCost = withdrawEthReceipt.gasUsed.mul(withdrawEthReceipt.effectiveGasPrice);
      verifyEqualValues(await getEthBalance(stealthKeyPair.address), 0);
      verifyEqualValues(
        await getEthBalance(destinationWallet.address),
        BigNumber.from(initialEthBalance).sub(withdrawTokenTxCost)
      );
    });

    it('With payload extension: send tokens, scan for them, withdraw them', async () => {
      // SENDER
      // Mint Dai to sender, and approve the Umbra contract to spend their DAI
      await mintAndApproveDai(sender, sender.address, quantity);

      // Send funds with Umbra
      const { tx, stealthKeyPair } = await umbra.send(sender, dai.address, quantity, receiver!.publicKey, overrides);
      await tx.wait();

      // RECEIVER
      // Receiver scans for funds sent to them
      const { userAnnouncements } = await umbra.scan(receiver.publicKey, receiver.privateKey);
      expect(userAnnouncements.length).to.be.greaterThan(0);

      // Withdraw (test withdraw by signature)
      const destinationWallet = ethers.Wallet.createRandom();
      const relayerWallet = ethers.Wallet.createRandom();
      const sponsorWallet = ethers.Wallet.createRandom();
      const sponsorFee = '2500';

      // Fund relayer
      await sender.sendTransaction({ to: relayerWallet.address, value: parseEther('1') });

      // Get signature
      const stealthPrivateKey = Umbra.computeStealthPrivateKey(receiver.privateKey, userAnnouncements[0].randomNumber);
      const { v, r, s } = await Umbra.signWithdraw(
        stealthPrivateKey,
        (await ethersProvider.getNetwork()).chainId,
        umbra.umbraContract.address,
        destinationWallet.address,
        dai.address,
        sponsorWallet.address,
        sponsorFee
      );

      // Relay transaction
      await umbra.withdrawOnBehalf(
        relayerWallet,
        stealthKeyPair.address,
        destinationWallet.address,
        dai.address,
        sponsorWallet.address,
        sponsorFee,
        v,
        r,
        s
      );
      const expectedAmountReceived = BigNumber.from(quantity).sub(sponsorFee);
      verifyEqualValues(await dai.balanceOf(destinationWallet.address), expectedAmountReceived);
      verifyEqualValues(await dai.balanceOf(stealthKeyPair.address), 0);
      verifyEqualValues(await dai.balanceOf(sponsorWallet.address), sponsorFee);
    });

    it('Without payload extension: send ETH, scan for it, withdraw it', async () => {
      // SENDER
      // Send funds with Umbra
      const { tx, stealthKeyPair } = await umbra.send(sender, ETH_ADDRESS, quantity, receiver!.publicKey, overrides);
      await tx.wait();
      verifyEqualValues(await getEthBalance(stealthKeyPair.address), quantity);

      // RECEIVER
      // Receiver scans for funds sent to them
      const { userAnnouncements } = await umbra.scan(receiver.publicKey, receiver.privateKey);
      expect(userAnnouncements.length).to.be.greaterThan(0);

      // Withdraw (test regular withdrawal)
      // Destination wallet should have a balance equal to amount sent minus gas cost
      const stealthPrivateKey = Umbra.computeStealthPrivateKey(receiver.privateKey, userAnnouncements[0].randomNumber);
      const destinationWallet = ethers.Wallet.createRandom();
      const withdrawTx = await umbra.withdraw(stealthPrivateKey, 'ETH', destinationWallet.address);
      await withdrawTx.wait();
      const receipt = await ethers.provider.getTransactionReceipt(withdrawTx.hash);
      const txCost = withdrawTx.gasLimit.mul(receipt.effectiveGasPrice);
      verifyEqualValues(await getEthBalance(destinationWallet.address), quantity.sub(txCost));
      verifyEqualValues(await getEthBalance(stealthKeyPair.address), 0);
    });

    it('With payload extension: send ETH, scan for it, withdraw it', async () => {
      // SENDER
      // Send funds with Umbra
      const { tx, stealthKeyPair } = await umbra.send(sender, ETH_ADDRESS, quantity, receiver.publicKey, overrides);
      await tx.wait();

      // RECEIVER
      // Receiver scans for funds send to them
      const { userAnnouncements } = await umbra.scan(receiver.publicKey, receiver.privateKey);
      expect(userAnnouncements.length).to.be.greaterThan(0);

      // Withdraw (test regular withdrawal)
      // Destination wallet should have a balance equal to amount sent minus gas cost
      const stealthPrivateKey = Umbra.computeStealthPrivateKey(receiver.privateKey, userAnnouncements[0].randomNumber);
      const destinationWallet = ethers.Wallet.createRandom();
      const withdrawTx = await umbra.withdraw(stealthPrivateKey, 'ETH', destinationWallet.address);
      await withdrawTx.wait();
      const receipt = await ethers.provider.getTransactionReceipt(withdrawTx.hash);
      const txCost = withdrawTx.gasLimit.mul(receipt.effectiveGasPrice);
      verifyEqualValues(await getEthBalance(destinationWallet.address), quantity.sub(txCost));
      verifyEqualValues(await getEthBalance(stealthKeyPair.address), 0);
    });
  });

  describe('Input validation', () => {
    // ts-expect-error statements needed throughout this section to bypass TypeScript checks that would stop this file
    // from being compiled/ran

    it('throws when initializing with an invalid chainConfig', () => {
      const errorMsg1 = "Invalid start block provided in chainConfig. Got 'undefined'";
      const errorMsg2 = "Invalid start block provided in chainConfig. Got '1'";
      const badChainId = '1.1';
      const errorMsg3 = `Invalid chainId provided in chainConfig. Got '${badChainId}'`;
      const errorMsg4 = "Invalid subgraphUrl provided in chainConfig. Got 'undefined'";
      const umbraAddress = '0xFb2dc580Eed955B528407b4d36FfaFe3da685401'; // address does not matter here

      // @ts-expect-error
      expect(() => new Umbra(ethersProvider)).to.throw('chainConfig not provided');
      // @ts-expect-error
      expect(() => new Umbra(ethersProvider, {})).to.throw(errorMsg1);
      // @ts-expect-error
      expect(() => new Umbra(ethersProvider, { umbraAddress })).to.throw(errorMsg1);
      // @ts-expect-error
      expect(() => new Umbra(ethersProvider, { umbraAddress: '123', startBlock: '1', subgraphUrl: false })).to.throw(
        errorMsg2
      );
      expect(
        // @ts-expect-error
        () => new Umbra(ethersProvider, { umbraAddress: '123', startBlock: 1, chainId: badChainId, subgraphUrl: false })
      ).to.throw(errorMsg3);
      // @ts-expect-error
      expect(() => new Umbra(ethersProvider, { umbraAddress: '123', startBlock: 1, chainId: 1 })).to.throw(errorMsg4);
      // @ts-expect-error
      expect(() => new Umbra(ethersProvider, { startBlock: 0, chainId: 4, subgraphUrl: false })).to.throw(
        'invalid address (argument="address", value=undefined, code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
    });

    it('throws when isEth is passed a bad address', async () => {
      // These error messages come from ethers
      await expectRejection(
        umbra.send(sender, '123', '1', '1'), // last two args are dummy args since we're testing the second input
        'invalid address (argument="address", value="123", code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
      await expectRejection(
        // @ts-expect-error
        umbra.send(sender, 123, '1', '1'), // last two args are dummy args since we're testing the second input
        'invalid address (argument="address", value=123, code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
    });

    it('throws when signWithdraw is passed a bad address', async () => {
      // Actual values of input parameters don't matter for this test
      const privateKey = receiver.privateKey;
      const goodAddress = receiver.address;
      const badAddress = '0x123';
      const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // address does not matter here
      // These error messages come from ethers
      await expectRejection(
        Umbra.signWithdraw(privateKey, 4, umbra.umbraContract.address, badAddress, tokenAddress, goodAddress, '1'),
        'invalid address (argument="address", value="0x123", code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
      await expectRejection(
        Umbra.signWithdraw(privateKey, 4, umbra.umbraContract.address, goodAddress, tokenAddress, badAddress, '1'),
        'invalid address (argument="address", value="0x123", code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
      await expectRejection(
        Umbra.signWithdraw(privateKey, 4, badAddress, goodAddress, tokenAddress, goodAddress, '1'),
        'invalid address (argument="address", value="0x123", code=INVALID_ARGUMENT, version=address/5.5.0)'
      );
    });

    it('throws when signWithdraw is passed a bad chainId', async () => {
      // Actual values of input parameters don't matter for this test
      const privateKey = receiver.privateKey;
      const address = receiver.address;
      const badChainId = '4';
      const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // address does not matter here
      await expectRejection(
        // @ts-expect-error
        Umbra.signWithdraw(privateKey, badChainId, umbra.umbraContract.address, address, tokenAddress, address, '1'),
        `Invalid chainId provided in chainConfig. Got '${badChainId}'`
      );
    });

    it('throws when signWithdraw is passed a bad data string', async () => {
      // Actual values of input parameters don't matter for this test
      const privateKey = receiver.privateKey;
      const address = receiver.address;
      const badData = 'qwerty';
      const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // address does not matter here
      await expectRejection(
        Umbra.signWithdraw(
          privateKey,
          4,
          umbra.umbraContract.address,
          address,
          tokenAddress,
          address,
          '1',
          ethers.constants.AddressZero,
          badData
        ),
        'Data string must be null or in hex format with 0x prefix'
      );
    });
  });
});
