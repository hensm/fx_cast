"use strict";

import React from "react";


const LICENSE =
`Copyright (c) 2018 Matt Hensman <m@matt.tf>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;


const Translator = (props: { name: string, tag: string }) =>
    <li className="translator">
        { props.name }
        <div className="translator__tag">
            { props.tag }
        </div>
    </li>;

export default () =>
    <details className="about">
        <summary>
            <h2>About</h2>
        </summary>
        <div className="about__container">
            <ul className="about__links">
                <li>
                    <a className="about__link"
                    href="https://github.com/hensm/fx_cast">
                        <img src="assets/icons8-github-24.png"
                            srcSet="assets/icons8-github-48.png 2x"
                            width="24"
                            alt="GitHub icon" />
                        @hensm/fx_cast
                    </a>
                </li>
                <li>
                    <a className="about__link"
                        href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3Z2FTMSG976WN&source=url">
                        <img src="assets/icons8-paypal-24.png"
                            srcSet="assets/icons8-paypal-48.png 2x"
                            width="24"
                            alt="PayPal icon" />
                        Donate via PayPal
                    </a>
                </li>
                <li>
                    <a className="about__link"
                        href="https://icons8.com">
                        <img src="assets/icons8-icons8-24.png"
                            srcSet="assets/icons8-icons8-48.png 2x"
                            width="24"
                            alt="icons8 icon" />
                        Icons by icons8
                    </a>
                </li>
            </ul>

            <hr />

            <details className="about__license">
                <summary>
                    <h3>License</h3>
                </summary>
                <textarea>
                    { LICENSE.replace(/(\S)\n(\S)/g, "$1 $2") }
                </textarea>
            </details>

            <hr />

            <details className="about__translators">
                <summary>
                    <h3>Translators</h3>
                </summary>
                <ul>
                    <Translator name="RAVMN" tag="es" />
                    <Translator name="rimrul" tag="de" />
                    <Translator name="ThaDaVos" tag="nl" />
                    <Translator name="Vistaus" tag="nl" />
                </ul>
            </details>
        </div>
    </details>;
