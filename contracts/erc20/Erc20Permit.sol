/* SPDX-License-Identifier: LGPL-3.0-or-later */
pragma solidity ^0.7.1;

import "./Erc20.sol";
import "./Erc20PermitStorage.sol";

/**
 * @title Erc20Permit
 * @author Mainframe
 * @notice Extension of Erc20 that allows token holders to use their tokens
 * without sending any transactions by setting the allowance with a signature
 * using the `permit` method, and then spend them via `transferFrom`.
 * @dev See https://eips.ethereum.org/EIPS/eip-2612.
 */
contract Erc20Permit is Erc20, Erc20PermitStorage {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) Erc20(name_, symbol_, decimals_) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                address(this)
            )
        );
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over `owner`'s tokens,
     * assuming the latter's signed approval.
     *
     * IMPORTANT: The same issues Erc20 `approve` has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `deadline` must be a timestamp in the future.
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the Eip712-formatted function arguments.
     * - The signature must use `owner`'s current nonce.
     */
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "ERR_ERC20_PERMIT_EXPIRED");
        bytes32 hashStruct = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, amount, nonces[owner]++, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashStruct));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0x00), "ERR_ERC20_PERMIT_ZERO_ADDRESS");
        require(recoveredAddress == owner, "ERR_ERC20_PERMIT_INVALID_SIGNATURE");
        approveInternal(owner, spender, amount);
    }
}