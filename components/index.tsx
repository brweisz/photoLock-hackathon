// @ts-nocheck

import React, { useEffect, useState } from 'react';

import { useOnChainVerification } from '../hooks/useOnChainVerification.js';
import { compileCircuit } from '../circuit/compile.js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import { toast } from 'react-toastify';
// import { useReadUltraVerifierVerify } from '../artifacts/generated.js';
import { bytesToHex } from 'viem';
import { generateVerifierContract } from './contract.js';


export default function Component() {

  // let connectDisconnectButton=undefined;
  // let isConnected=false;
  let { isConnected, connectDisconnectButton } = useOnChainVerification();

  const [backend, setBackend] = useState();
  let [provingArgs, setProvingArgs] = useState();
  const [args, setArgs] = useState();
  const [currentCompiledCircuit, setCurrentCompiledCircuit] = useState();
  // const { data, error } = useReadUltraVerifierVerify({args, query: {enabled: !!args}});

  const generateProof = async (inputs: any) => {
    if (!inputs) return;

    const compiledCircuit = await compileCircuit(inputs.noir_program);
    const barretenbergBackend = new BarretenbergBackend(compiledCircuit, { threads: navigator.hardwareConcurrency });
    const noir = new Noir(compiledCircuit);
    deactivateSpinner();

    await toast.promise(noir.init, {
      pending: 'Initializing Noir...',
      success: 'Noir initialized!',
      error: 'Error initializing Noir',
    });

    const { witness } = await toast.promise(noir.execute(inputs), {
      pending: 'ACVM Executing compiledCircuit --> Generating witness',
      success: 'Witness generated',
      error: 'Error generating witness',
    });
    if (!witness) return;

    const proofData = await toast.promise(barretenbergBackend.generateProof(witness), {
      pending: 'Generating proof',
      success: 'Proof generated',
      error: 'Error generating proof',
    });
    if (!proofData) return;
    setProvingArgs(proofData)
    setBackend(barretenbergBackend)
    setCurrentCompiledCircuit(compiledCircuit)
  };

  const getSpinnerElements = () => {
    const spinner = document.getElementById('spinner')!;
    const submitBtn = document.getElementById('submit')!;
    return [submitBtn, spinner];
  };

  const deactivateSpinner = () => {
    let [submitBtn, spinner] = getSpinnerElements();
    spinner.style.display = 'none';
    submitBtn.disabled = false;
  };

  const activateSpinner = () => {
    let [submitBtn, spinner] = getSpinnerElements();
    spinner.style.display = 'inline-block';
    submitBtn.disabled = true;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    try {
      await _submit(e);
    } catch {
      deactivateSpinner();
    }
  };

  const verifyOnChain = async function() {
    setArgs([bytesToHex(provingArgs.proof), provingArgs.publicInputs as `0x${string}`[]]);
  }

  /*useEffect(() => {
    if (data) {
      toast.success( 'Proof verified on-chain!', {
        isLoading: false,
        autoClose: 5000
      })
    } else if (error) {
      toast.error(`Failed proof verification on-chain: ${error}`, {
        isLoading: false,
        autoClose: 5000
      });
    }
    setArgs(undefined)
  }, [data, error]);*/

  const verifyOffChain = async function(){
    await toast.promise(backend.verifyProof(provingArgs), {
      pending: 'Verifying proof off-chain',
      success: 'Proof verified off-chain',
      error: 'Error verifying proof off-chain',
    });
  }

  const _submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    activateSpinner();

    const elements = e.currentTarget.elements;
    if (!elements) return;

    const x = elements.namedItem('x') as HTMLInputElement;
    const y = elements.namedItem('y') as HTMLInputElement;
    const noir_program = elements.namedItem('noir_program') as HTMLInputElement;

    let inputs = {
      x: x.value,
      y: y.value,
      noir_program: noir_program.value,
    };

    await generateProof(inputs);
  };

  async function generateAndDeployContract(){
    console.log("Deploying")
    if (!currentCompiledCircuit) {
      console.log("Cannot generate contract because no circuit was provided")
    }
    let contractSourceCode = await generateVerifierContract(currentCompiledCircuit)
    console.log("Contract successfully created")
    console.log("Compiling and deploying contract")
    let address = await compileAndDeploy(contractSourceCode)
  }

  const compileAndDeploy = async (contractSourceCode) => {
    const response = await fetch('/api/compile-and-deploy-contract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contractSourceCode }),
    });

    const data = await response.json();
    console.log('Deployed contract address:', data.object.contractAddress);
    return data.object.contractAddress
  };

  return (
    <>
      <form className="container" onSubmit={submit}>
        <h2>Noir <span className="funky-typography">Playground</span></h2>
        {connectDisconnectButton}
        <h4>Write you own noir circuit with <i>x</i> and <i>y</i> as input names</h4>
        <p>main.nr</p>
        <textarea className="program" name="noir_program" required={true}/>
        <p>Try it!</p>
        <div className="inputs">
          <input className="text-input" name="x" type="text" placeholder="x" required={true}/>
          <input className="text-input" name="y" type="text" placeholder="y" required={true}/>
        </div>
        <div className="generate-proof-button-container">
          <button className="button prove-button" type="submit" id="submit">Calculate proof</button>
          <div className="spinner-button" id="spinner"></div>
          <button className="button verify-button" type="button" onClick={verifyOffChain} disabled={!currentCompiledCircuit}>
            Verify off-chain</button>
        </div>
        <button className="button verify-button" type="button" onClick={generateAndDeployContract} disabled={!currentCompiledCircuit}> Generate Verifier Contract
        </button>

        <div className="verify-button-container">
          <button className="button verify-button" type="button" onClick={verifyOnChain} disabled={!isConnected || !currentCompiledCircuit}>
            Verify on-chain
          </button>

        </div>
      </form>
    </>
  );
}

