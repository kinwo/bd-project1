/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

// 5 mins
const MesgTimeLimitSec = 5 * 60;

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: 'Genesis Block' });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    let self = this;
    return new Promise((resolve, reject) => {
      resolve(self.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't forget
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        // update block attributes
        block.time = new Date().getTime().toString().slice(0, -3);
        block.height = self.chain.length;
        if (!block.isGenesisBlock()) {
          block.previousBlockHash = self.chain[self.chain.length - 1].hash;
        }

        block.hash = SHA256(JSON.stringify(block)).toString();

        // validate chain
        const errorLogs = await self.validateChain();
        if (errorLogs.length > 0) {
          console.error(errorLogs);
          throw new Error('Invalid blockchain');
        }

        // add to blockchain
        self.chain.push(block);

        // update blockchain height
        self.height = block.height;

        resolve(block);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      const mesg = `${address}:${new Date()
        .getTime()
        .toString()
        .slice(0, -3)}:starRegistry`;
      resolve(mesg);
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        const time = parseInt(message.split(':')[1]);
        const currentTime = parseInt(
          new Date().getTime().toString().slice(0, -3)
        );

        // Check if the time elapsed is less than 5 minutes
        const elapsedTime = currentTime - time;
        if (elapsedTime > MesgTimeLimitSec) {
          throw new Error(
            `Rejected: Exceed time limit of more than ${MesgTimeLimitSec} secs`
          );
        }

        // Veify the message
        const isVerified = bitcoinMessage.verify(message, address, signature);
        if (!isVerified) {
          throw new Error('Message verification failed');
        }

        // Create block
        const data = {
          owner: address,
          star,
        };
        const block = new BlockClass.Block(data);

        // Add to chain
        await self._addBlock(block);

        resolve(block);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      const block = self.chain.find((myBlock) => {
        return myBlock.hash === hash;
      });

      if (block !== null) {
        resolve(block);
      } else {
        reject('Block with the hash not found');
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter((p) => p.height === height)[0];
      if (block) {
        resolve(block);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    return new Promise((resolve, reject) => {
      try {
        let allPromises = [];
        for (let i = 0; i < self.chain.length; i++) {
          const myBlock = self.chain[i];
          const promise = myBlock.getBData().then((data) => {
            if (data.owner === address) {
              return data;
            }

            return null;
          });
          allPromises.push(promise);
        }

        Promise.all(allPromises).then((result) => {
          const stars = result.filter((value) => value != null);
          resolve(stars);
        });
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check with the previousBlockHash
   */
  validateChain() {
    let self = this;
    let errorLog = [];

    return new Promise(async (resolve, reject) => {
      try {
        for (let i = 0; i < self.chain.length; i++) {
          const block = self.chain[i];

          const isValid = await block.validate();
          if (!isValid) {
            console.error(`Invalid block ${i}`);
            errorLog.push(i);
          } else {
            const nextBlockIndex = i + 1;
            if (nextBlockIndex < self.chain.length) {
              const nextBlock = self.chain[i + 1];
              const previousHashOfNextBlock = nextBlock.previousBlockHash;
              if (block.hash != previousHashOfNextBlock) {
                console.error(
                  `Block ${i + 1} previousHashOfNextBlock is not matched`
                );
                errorLog.push(i);
              }
            }
          }
        }

        resolve(errorLog);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports.Blockchain = Blockchain;
