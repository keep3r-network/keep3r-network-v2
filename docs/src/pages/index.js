import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function HomepageHeader() {
	const {siteConfig} = useDocusaurusContext();
	return (
		<>
			<header className={clsx('hero hero--primary', styles.heroBanner)}>
				<div className="container" style={{paddingTop: '4rem', paddingBottom: '0', background: 'black'}}>
					<h1 className="hero__title" style={{color: 'white'}}>{siteConfig.title}</h1>
					<p className="hero__subtitle" style={{color: 'white'}}>{siteConfig.tagline}</p>
					<div className={styles.buttons}>
						<Link
							className="button button--secondary button--lg"
							to="/docs/intro">
							Read the Docs
						</Link>
					</div>
				</div>
			</header>
			<div style={{background: 'white'}}>
				<div className="container" style={{marginTop: '6rem', color: 'black'}}>
					<section aria-label={'UNDERSTAND SETUP'}>
						<div className={'grid w-full grid-cols-1 gap md:grid-cols-2'} style={{textAlign: 'left'}}>
							<div>
								<h2 className={'text-xl font-bold'}>{'UNDERSTAND SETUP'}</h2>
								<div className={'mt-4 space-y-6'}>
									<p>{'A "keeper" is a term used to refer to an external person and/or team that executes a job. This can be as simplistic as sending a transaction, or as complex as requiring extensive off-chain logic.'}</p>

									<p>{'The scope of Keep3r Network is not to manage the jobs themselves, but to allow contracts to register as jobs for keepers, and keepers to register themselves as available to perform jobs.'}</p>
											
									<p>{'It is up to the individual keepers to set up their DevOps and infrastructure and create their own rules based on what job they deem profitable.'}</p>
								</div>
							</div>

							<div>
								<h2 className={'text-xl font-bold'}>{'JOBS AND REWARDS'}</h2>
								<div className={'mt-4 space-y-6'}>

									<p>
										{'Each time keepers perform such a job, they are rewarded in either ETH, tokens, or systems native token KP3R. The maximum amount of KP3R to receive is '}
										<code className={'inline text-grey-2'}>{'gasUsed'}</code>
										{' + premium (configurable by governance).'}
									</p>
											
									<div>
										<p>{'Some jobs might require keepers to have:'}</p>
										<p style={{marginBottom: '-0.2rem'}}>{'– minimum amount of bonded tokens'}</p>
										<p style={{marginBottom: '-0.2rem'}}>{'– minimum amount of fees earned'}</p>
										<p style={{marginBottom: '-0.2rem'}}>{'– minimum time presence in the system'}</p>
									</div>
									<p>{'At the simplest level, they require a keeper to be registered in the system.'}</p>
								</div>
							</div>
							<div>
								<h2 className={'text-xl font-bold'}>{'BECOME KEEPER'}</h2>
								<div className={'mt-4 mb-8 space-y-6'}>  
									<p>
										{'To join as a keeper, you simply need to call '}
										<code className={'inline text-grey-2'}>{'bond(address,uint)'}</code>
										{'. No funds are required to become a keeper, however, certain jobs might require a minimum amount of funds.'}
									</p>

									<p>
										{'After waiting '}
										<code className={'inline text-grey-2'}>{'bondTime'}</code>
										{' bonding delay (default 3 days) and you can '}
										<code className={'inline text-grey-2'}>{'activate'}</code>
										{' as a keeper.'}
									</p>

									<p>
										<a href={'https://docs.keep3r.network/core/keepers'} target={'_blank'} rel={'noreferrer'} className={'underline'} style={{color: 'black', fontWeight: 'bold'}}>
											<span className={'sr-only'}>{'Learn more about the keepers'}</span>
											{'More'}
										</a>
										{' about keeper\'s lifecycle.'}
									</p>

								</div>
							</div>

							<div>
								<h2 className={'text-xl font-bold'}>{'FIND JOB'}</h2>
								<div className={'mt-4 mb-8 space-y-6'}>  
									<p>
										{'Keep3r Network provides keepers with a list of available jobs. A job is a term used to refer to a smart contract which is awaiting for an external entity to perform an action. Keepers can choose which actions to perform. It might be dictated by job owner restrictions or keeper preferences.'}
									</p>
									<p>
										{'However, action should be performed in "good will" without any malicious intent. For this reason, action is registered as a job keepers can then execute on its contract.'}
									</p>
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</>
	);
}

export default function Home() {
	const {siteConfig} = useDocusaurusContext();
	return (
		<Layout
			title={`Hello from ${siteConfig.title}`}
			wrapperClassName={'bg-white'}
			description={siteConfig.tagline}>
			<HomepageHeader />
		</Layout>
	);
}
